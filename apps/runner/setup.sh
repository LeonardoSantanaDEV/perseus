#!/usr/bin/env bash
# ===========================================================================
#  Perseus Runner - Setup (Linux/macOS)
#
#  Faz TODA a configuracao da maquina (VM, VPS, servidor fisico) numa unica
#  execucao: cria o ambiente virtual, instala as dependencias e roda o wizard
#  de provisionamento (URL do Perseus, login, token).
#
#  Uso:  chmod +x setup.sh && ./setup.sh
#  Depois, suba a runner com:  ./runner.sh
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Perseus Runner - Setup ==="
echo

# 1. Localiza o Python 3
PY="${PYTHON_BIN:-}"
if [ -z "$PY" ]; then
  if command -v python3 >/dev/null 2>&1; then PY="python3"
  elif command -v python >/dev/null 2>&1; then PY="python"
  else
    echo "[erro] Python 3 nao encontrado. Instale o Python 3.10+ e tente de novo."
    exit 1
  fi
fi

# 2. Cria o ambiente virtual, se necessario
if [ ! -x ".venv/bin/python" ]; then
  echo "[setup] Criando ambiente virtual .venv ..."
  "$PY" -m venv .venv
fi
VENV_PY=".venv/bin/python"

# 3. Instala/atualiza dependencias
echo "[setup] Instalando dependencias ..."
"$VENV_PY" -m pip install --upgrade pip >/dev/null
"$VENV_PY" -m pip install -r requirements.txt

# 4. Wizard de provisionamento (grava o .env)
echo
echo "[setup] Provisionamento: informe a URL do Perseus, faca login e escolha"
echo "        criar uma nova runner ou usar uma existente (token)."
echo
"$VENV_PY" -m runner.setup

echo
echo "[setup] Concluido! A maquina esta configurada."
echo "        Para subir a runner (ONLINE no orquestrador), execute:  ./runner.sh"
