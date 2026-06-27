@echo off
setlocal
REM ===========================================================================
REM  Perseus Runner - Iniciar (Windows)
REM
REM  Sobe a runner: conecta ao Perseus e deixa a maquina DISPONIVEL (ONLINE)
REM  no orquestrador, pronta para receber tarefas. Mantenha esta janela aberta.
REM
REM  Pre-requisito: rodar setup.bat uma vez antes.
REM  Para subir no boot, registre como servico (NSSM / Agendador de Tarefas).
REM ===========================================================================

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [runner] Ambiente nao encontrado. Rode setup.bat primeiro.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [runner] Arquivo .env nao encontrado. Rode setup.bat para provisionar.
  echo.
  pause
  exit /b 1
)

echo [runner] Conectando ao Perseus... (Ctrl+C para parar)
".venv\Scripts\python.exe" -m runner.main
