import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from typing import Callable, Optional

import requests

from .config import Config
from .logger import log

LogFn = Callable[[str, str], None]


def _venv_python(venv_dir: str) -> str:
    if sys.platform.startswith("win"):
        return os.path.join(venv_dir, "Scripts", "python.exe")
    return os.path.join(venv_dir, "bin", "python")


def _sha256(path: str) -> str:
    """Calcula o SHA-256 de um arquivo em blocos (sem carregar tudo na memória)."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_ready(env_dir: str) -> Optional[dict]:
    """Lê o marcador .ready do ambiente cacheado, ou None se ausente/inválido."""
    marker = os.path.join(env_dir, ".ready")
    try:
        with open(marker, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _write_ready(env_dir: str, version: str, zip_hash: str) -> None:
    """Grava o marcador .ready indicando qual versão/zip está instalado no venv."""
    marker = os.path.join(env_dir, ".ready")
    with open(marker, "w", encoding="utf-8") as f:
        json.dump({"version": version, "zipHash": zip_hash}, f)


def _safe_segment(value: str) -> str:
    """Sanitiza um identificador para usar como nome de diretório."""
    safe = "".join(c if c.isalnum() or c in ("-", "_", ".") else "_" for c in value)
    return safe or "default"


def _find_entrypoint(src_dir: str, entrypoint: str) -> str:
    direct = os.path.join(src_dir, entrypoint)
    if os.path.isfile(direct):
        return direct
    for root, _dirs, files in os.walk(src_dir):
        if os.path.basename(entrypoint) in files:
            return os.path.join(root, os.path.basename(entrypoint))
    raise FileNotFoundError(f"Entrypoint '{entrypoint}' não encontrado no pacote")


def _safe_extract(zip_file: zipfile.ZipFile, dest_dir: str) -> None:
    """
    Extrai o zip protegendo contra Zip Slip (path traversal) e symlinks.
    Cada entrada deve permanecer dentro de dest_dir.
    """
    dest_root = os.path.realpath(dest_dir)
    for member in zip_file.infolist():
        # Bloqueia caminhos absolutos e traversal
        name = member.filename
        if name.startswith(("/", "\\")) or ".." in name.replace("\\", "/").split("/"):
            raise ValueError(f"Entrada de zip insegura (path traversal): {name}")

        target = os.path.realpath(os.path.join(dest_root, name))
        if target != dest_root and not target.startswith(dest_root + os.sep):
            raise ValueError(f"Entrada de zip fora do diretório de destino: {name}")

        # Bloqueia symlinks embutidos no zip (modo Unix nos 16 bits altos)
        mode = member.external_attr >> 16
        if mode and (mode & 0o170000) == 0o120000:
            raise ValueError(f"Symlink não permitido no pacote: {name}")

    zip_file.extractall(dest_dir)


def run_task(config: Config, task: dict, emit_log: "LogFn") -> int:
    task_id = task["taskId"]
    automation_id = str(task.get("automationId") or task_id)
    version = str(task.get("version") or "")

    # Diretório efêmero da execução (descartado ao final) e ambiente persistente
    # cacheado por automação (1 venv por automação, sobrescrito ao mudar a versão).
    run_dir_root = os.path.abspath(os.path.join(config.work_dir, "runs", task_id))
    env_dir = os.path.abspath(
        os.path.join(config.env_cache_dir, _safe_segment(automation_id))
    )
    src_dir = os.path.join(run_dir_root, "src")
    venv_dir = os.path.join(env_dir, "venv")

    log.info(
        "[%s] Iniciando execução. run_dir=%s env_dir=%s",
        task_id[:8], run_dir_root, env_dir,
    )

    if os.path.exists(run_dir_root):
        shutil.rmtree(run_dir_root, ignore_errors=True)
    os.makedirs(src_dir, exist_ok=True)
    os.makedirs(env_dir, exist_ok=True)

    # 1. Download do pacote
    msg = "Baixando pacote..."
    log.info("[%s] %s url=%s", task_id[:8], msg, task.get("downloadUrl", "?")[:60])
    emit_log(msg, "info")
    zip_path = os.path.join(run_dir_root, "package.zip")
    with requests.get(task["downloadUrl"], stream=True, timeout=120) as r:
        r.raise_for_status()
        total = 0
        with open(zip_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)
    log.info("[%s] Pacote baixado: %.1f KB", task_id[:8], total / 1024)

    # 1b. Decisão de cache: o venv é reaproveitado enquanto a versão/zip não mudar.
    zip_hash = _sha256(zip_path)
    ready = _read_ready(env_dir)
    cache_hit = (
        not config.force_reinstall
        and ready is not None
        and os.path.exists(_venv_python(venv_dir))
        and ready.get("version") == version
        and ready.get("zipHash") == zip_hash
    )

    # 2. Extração (sempre — precisamos do código-fonte para executar o entrypoint)
    msg = "Extraindo pacote..."
    log.info("[%s] %s", task_id[:8], msg)
    emit_log(msg, "info")
    with zipfile.ZipFile(zip_path) as z:
        _safe_extract(z, src_dir)

    entrypoint_path = _find_entrypoint(src_dir, task.get("entrypoint", "main.py"))
    run_dir = os.path.dirname(entrypoint_path)
    log.info("[%s] Entrypoint: %s", task_id[:8], entrypoint_path)

    py = _venv_python(venv_dir)

    if cache_hit:
        log.info(
            "[%s] Ambiente reaproveitado do cache (version=%s).",
            task_id[:8], version,
        )
        emit_log("Ambiente já preparado (cache)...", "info")
    else:
        # Versão/zip mudou (ou primeira execução): reconstrói o venv do zero.
        log.info(
            "[%s] Cache inválido (version=%s force=%s). Reinstalando ambiente.",
            task_id[:8], version, config.force_reinstall,
        )
        # Remove marcador antes de mexer no venv: se algo falhar no meio, o
        # ambiente fica marcado como "não pronto" e a próxima execução refaz.
        marker = os.path.join(env_dir, ".ready")
        if os.path.exists(marker):
            os.remove(marker)
        if os.path.exists(venv_dir):
            shutil.rmtree(venv_dir, ignore_errors=True)

        # 3. Criação do ambiente virtual
        msg = "Criando ambiente virtual..."
        log.info("[%s] %s python=%s", task_id[:8], msg, config.python_bin)
        emit_log(msg, "info")
        result = subprocess.run(
            [config.python_bin, "-m", "venv", venv_dir],
            check=True,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            log.error("[%s] Falha ao criar venv:\n%s", task_id[:8], result.stderr)

        # 3b. Instala o SDK do Perseus no venv (se configurado)
        if config.sdk_path and os.path.isdir(config.sdk_path):
            msg = "Instalando SDK do Perseus..."
            log.info("[%s] %s sdk_path=%s", task_id[:8], msg, config.sdk_path)
            emit_log(msg, "info")
            proc = subprocess.run(
                [py, "-m", "pip", "install", "-q", "-e", config.sdk_path],
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                log.warning("[%s] Aviso ao instalar SDK:\n%s", task_id[:8], proc.stderr)

        # 4. Instalação de dependências
        req = os.path.join(run_dir, "requirements.txt")
        if os.path.isfile(req):
            msg = "Instalando dependências..."
            log.info("[%s] %s", task_id[:8], msg)
            emit_log(msg, "info")
            proc = subprocess.run(
                [py, "-m", "pip", "install", "-q", "-r", req],
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                log.error("[%s] Falha ao instalar dependências:\n%s", task_id[:8], proc.stderr)
                emit_log(proc.stdout, "info")
                emit_log(proc.stderr, "error")
                emit_log("Falha ao instalar dependências", "error")
                # Não deixa venv meio-instalado: remove para a próxima retentar limpo.
                shutil.rmtree(venv_dir, ignore_errors=True)
                return proc.returncode
            log.info("[%s] Dependências instaladas.", task_id[:8])

        # 4b. Marca o ambiente como pronto para esta versão/zip.
        shutil.copy2(zip_path, os.path.join(env_dir, "package.zip"))
        _write_ready(env_dir, version, zip_hash)
        log.info("[%s] Ambiente preparado e cacheado (version=%s).", task_id[:8], version)

    # 5. Variáveis de ambiente para o bot / SDK
    env = os.environ.copy()
    env["PERSEUS_URL"] = config.api_url
    env["TASK_ID"] = task_id
    env["TASK_TOKEN"] = task["taskToken"]
    env["PERSEUS_PARAMS"] = json.dumps(task.get("params") or {})
    env["PYTHONPATH"] = os.pathsep.join(
        [p for p in [env.get("PYTHONPATH", "")] if p]
    )

    # 6. Execução do entrypoint
    entry_name = os.path.basename(entrypoint_path)
    msg = f"Executando {entry_name}..."
    log.info("[%s] %s", task_id[:8], msg)
    emit_log(msg, "info")
    process = subprocess.Popen(
        [py, "-u", entrypoint_path],
        cwd=run_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    for line in process.stdout:
        stripped = line.rstrip("\n")
        log.debug("[%s] stdout: %s", task_id[:8], stripped)
        emit_log(stripped, "info")
    process.wait()

    rc = process.returncode
    msg = f"Processo finalizado com código {rc}"
    if rc == 0:
        log.info("[%s] %s", task_id[:8], msg)
    else:
        log.error("[%s] %s", task_id[:8], msg)
    emit_log(msg, "info" if rc == 0 else "error")
    return rc
