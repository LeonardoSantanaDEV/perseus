#!/usr/bin/env bash
# ===========================================================================
#  Perseus Runner - Iniciar (Linux/macOS)
#
#  Sobe a runner: conecta ao Perseus e deixa a maquina DISPONIVEL (ONLINE)
#  no orquestrador, pronta para receber tarefas.
#
#  Pre-requisito: rodar ./setup.sh uma vez antes.
#  Para subir no boot, registre como servico (systemd).
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
  echo "[runner] Ambiente nao encontrado. Rode ./setup.sh primeiro."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "[runner] Arquivo .env nao encontrado. Rode ./setup.sh para provisionar."
  exit 1
fi

echo "[runner] Conectando ao Perseus... (Ctrl+C para parar)"
exec .venv/bin/python -m runner.main
