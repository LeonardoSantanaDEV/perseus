"""Wizard de provisionamento do runner Perseus.

Execute uma única vez, de forma interativa, na máquina que será o runner:

    python -m runner.setup

Fluxo:
  1. Pergunta a URL do Perseus.
  2. Autentica com login/senha (libera o uso desta máquina).
  3. Oferece:
       [1] Criar uma NOVA runner  -> o token é gerado e salvo automaticamente.
       [2] Usar uma runner EXISTENTE -> cole o token (obtido com o administrador).
  4. Grava PERSEUS_WS / PERSEUS_API / RUNNER_TOKEN no arquivo .env.

Depois disso, o serviço roda de forma não-interativa com:  python -m runner.main
"""

import os
import socket
import sys
from getpass import getpass

try:
    import requests
except ImportError:  # pragma: no cover
    print("Dependência ausente: requests. Rode: pip install -r requirements.txt")
    sys.exit(1)


# .env fica na raiz do app do runner (apps/runner/.env)
_RUNNER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(_RUNNER_DIR, ".env")
ENV_EXAMPLE_PATH = os.path.join(_RUNNER_DIR, ".env.example")


def _read_env_value(key: str) -> str:
    """Lê um valor já existente no .env (para pré-preencher defaults)."""
    if not os.path.isfile(ENV_PATH):
        return ""
    with open(ENV_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            stripped = line.strip()
            if stripped.startswith(f"{key}="):
                return stripped[len(key) + 1 :].strip()
    return ""


def _prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or default


def _normalize_base_url(raw: str) -> str:
    url = raw.strip().rstrip("/")
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "http://" + url
    # Aceita que o usuário cole a URL já com /api no fim
    if url.endswith("/api"):
        url = url[: -len("/api")]
    return url


def _login(api_url: str) -> str:
    """Autentica e retorna o accessToken (JWT)."""
    for attempt in range(1, 4):
        email = _prompt("E-mail")
        password = getpass("Senha: ")
        try:
            resp = requests.post(
                f"{api_url}/auth/login",
                json={"email": email, "password": password},
                timeout=15,
            )
        except requests.RequestException as exc:
            print(f"  Falha ao contatar a API: {exc}")
            print("  Verifique a URL do Perseus e se a API está no ar.")
            continue

        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            print(f"  Autenticado como {user.get('email')} (papel: {user.get('role')}).")
            return data["accessToken"]

        if resp.status_code == 401:
            print(f"  Credenciais inválidas (tentativa {attempt}/3).")
        else:
            print(f"  Erro inesperado no login: HTTP {resp.status_code} {resp.text}")

    print("Não foi possível autenticar. Abortando.")
    sys.exit(1)


def _list_runners(api_url: str, token: str) -> list:
    resp = requests.get(
        f"{api_url}/runners",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def _create_runner(api_url: str, token: str, label: str) -> str:
    """Cria uma nova runner e retorna o token (texto puro, mostrado uma vez)."""
    resp = requests.post(
        f"{api_url}/runners",
        headers={"Authorization": f"Bearer {token}"},
        json={"label": label},
        timeout=15,
    )
    if resp.status_code == 403:
        print(
            "\n  Seu usuário não tem permissão para criar runners "
            "(necessário ADMIN ou OPERATOR)."
        )
        print(
            "  Peça a um administrador para criar a runner e te passar o token, "
            "depois rode o setup escolhendo a opção [2]."
        )
        sys.exit(1)
    resp.raise_for_status()
    return resp.json()["token"]


def _choose_existing(api_url: str, token: str) -> str:
    runners = _list_runners(api_url, token)
    if runners:
        print("\nRunners existentes:")
        for i, r in enumerate(runners, 1):
            print(
                f"  {i}. {r.get('label')}  "
                f"(status={r.get('status')}, host={r.get('host') or '-'})"
            )
    else:
        print("\nNenhuma runner cadastrada ainda neste workspace.")
    print(
        "\nO token NÃO é recuperável pela API (é mostrado apenas na criação)."
    )
    print(
        "Cole o token desta máquina, obtido com o administrador "
        "(ou regenerado no portal)."
    )
    runner_token = _prompt("RUNNER_TOKEN")
    if not runner_token:
        print("Token vazio. Abortando.")
        sys.exit(1)
    return runner_token


def _update_env_file(updates: dict) -> None:
    """Grava as chaves no .env, preservando as demais linhas e comentários."""
    if os.path.isfile(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    elif os.path.isfile(ENV_EXAMPLE_PATH):
        with open(ENV_EXAMPLE_PATH, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    else:
        lines = []

    remaining = dict(updates)
    out = []
    for line in lines:
        stripped = line.lstrip()
        replaced = False
        for key in list(remaining):
            if stripped.startswith(f"{key}="):
                out.append(f"{key}={remaining.pop(key)}\n")
                replaced = True
                break
        if not replaced:
            out.append(line)

    if out and not out[-1].endswith("\n"):
        out[-1] += "\n"
    for key, value in remaining.items():
        out.append(f"{key}={value}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as fh:
        fh.writelines(out)


def main() -> None:
    print("=== Perseus Runner — Provisionamento ===\n")

    default_ws = _read_env_value("PERSEUS_WS") or "http://localhost:3000"
    base_url = _normalize_base_url(_prompt("URL do Perseus", default_ws))
    api_url = f"{base_url}/api"
    print(f"  Usando API: {api_url}\n")

    token = _login(api_url)

    print("\nO que deseja fazer?")
    print("  [1] Criar uma NOVA runner (token gerado e salvo automaticamente)")
    print("  [2] Usar uma runner EXISTENTE (informar o token do administrador)")
    choice = _prompt("Opção", "1")

    if choice == "1":
        label = _prompt("Nome da runner", socket.gethostname())
        runner_token = _create_runner(api_url, token, label)
        print(f"  Runner '{label}' criada e token salvo.")
    elif choice == "2":
        runner_token = _choose_existing(api_url, token)
    else:
        print("Opção inválida. Abortando.")
        sys.exit(1)

    _update_env_file(
        {
            "PERSEUS_WS": base_url,
            "PERSEUS_API": api_url,
            "RUNNER_TOKEN": runner_token,
        }
    )

    print(f"\nConfiguração salva em: {ENV_PATH}")
    print("Pronto! Para iniciar o runner:")
    print("    python -m runner.main")
    print("(ou registre como serviço — veja docs/07-provisionamento-runner.md)")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelado pelo usuário.")
        sys.exit(130)
