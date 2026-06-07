import json
import os
import shutil
import subprocess
import sys
import zipfile
from typing import Callable

import requests

from .config import Config

LogFn = Callable[[str, str], None]


def _venv_python(venv_dir: str) -> str:
    if sys.platform.startswith("win"):
        return os.path.join(venv_dir, "Scripts", "python.exe")
    return os.path.join(venv_dir, "bin", "python")


def _find_entrypoint(src_dir: str, entrypoint: str) -> str:
    direct = os.path.join(src_dir, entrypoint)
    if os.path.isfile(direct):
        return direct
    for root, _dirs, files in os.walk(src_dir):
        if os.path.basename(entrypoint) in files:
            return os.path.join(root, os.path.basename(entrypoint))
    raise FileNotFoundError(f"Entrypoint '{entrypoint}' não encontrado no pacote")


def run_task(config: Config, task: dict, emit_log: "LogFn") -> int:
    task_id = task["taskId"]
    work = os.path.abspath(os.path.join(config.work_dir, task_id))
    src_dir = os.path.join(work, "src")
    venv_dir = os.path.join(work, "venv")

    if os.path.exists(work):
        shutil.rmtree(work, ignore_errors=True)
    os.makedirs(src_dir, exist_ok=True)

    # 1. Download do pacote
    emit_log("Baixando pacote...", "info")
    zip_path = os.path.join(work, "package.zip")
    with requests.get(task["downloadUrl"], stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(zip_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    # 2. Extração
    emit_log("Extraindo pacote...", "info")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(src_dir)

    entrypoint_path = _find_entrypoint(src_dir, task.get("entrypoint", "main.py"))
    run_dir = os.path.dirname(entrypoint_path)

    # 3. Criação do ambiente virtual
    emit_log("Criando ambiente virtual...", "info")
    subprocess.run(
        [config.python_bin, "-m", "venv", venv_dir],
        check=True,
        capture_output=True,
    )
    py = _venv_python(venv_dir)

    # 3b. Instala o SDK do Perseus no venv (se configurado)
    if config.sdk_path and os.path.isdir(config.sdk_path):
        emit_log("Instalando SDK do Perseus...", "info")
        subprocess.run(
            [py, "-m", "pip", "install", "-q", "-e", config.sdk_path],
            capture_output=True,
            text=True,
        )

    # 4. Instalação de dependências
    req = os.path.join(run_dir, "requirements.txt")
    if os.path.isfile(req):
        emit_log("Instalando dependências...", "info")
        proc = subprocess.run(
            [py, "-m", "pip", "install", "-q", "-r", req],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            emit_log(proc.stdout, "info")
            emit_log(proc.stderr, "error")
            emit_log("Falha ao instalar dependências", "error")
            return proc.returncode

    # 5. Variáveis de ambiente para o bot / SDK
    env = os.environ.copy()
    env["PERSEUS_URL"] = config.api_url
    env["TASK_ID"] = task_id
    env["TASK_TOKEN"] = task["taskToken"]
    env["PERSEUS_PARAMS"] = json.dumps(task.get("params") or {})
    # Disponibiliza o SDK instalado no runner para o venv do bot
    env["PYTHONPATH"] = os.pathsep.join(
        [p for p in [env.get("PYTHONPATH", "")] if p]
    )

    # 6. Execução do entrypoint
    emit_log(f"Executando {os.path.basename(entrypoint_path)}...", "info")
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
        emit_log(line.rstrip("\n"), "info")
    process.wait()
    emit_log(f"Processo finalizado com código {process.returncode}", "info")
    return process.returncode
