@echo off
setlocal enabledelayedexpansion
REM ===========================================================================
REM  Perseus Runner - Setup (Windows)
REM
REM  Faz TODA a configuracao da maquina (VM, VPS, servidor fisico) numa unica
REM  execucao: cria o ambiente virtual, instala as dependencias e roda o wizard
REM  de provisionamento (URL do Perseus, login, token).
REM
REM  Uso: clique duas vezes em setup.bat (ou rode no terminal).
REM  Depois, suba a runner com:  runner.bat
REM ===========================================================================

cd /d "%~dp0"

echo === Perseus Runner - Setup ===
echo.

REM --- 1. Localiza o Python (py -3 de preferencia, senao python) ---
set "PYLAUNCH="
where py >nul 2>nul && set "PYLAUNCH=py -3"
if not defined PYLAUNCH (
  where python >nul 2>nul && set "PYLAUNCH=python"
)
if not defined PYLAUNCH (
  echo [erro] Python nao encontrado no PATH. Instale o Python 3.10+ e tente de novo.
  echo        https://www.python.org/downloads/  ^(marque "Add python.exe to PATH"^)
  goto :err
)

REM --- 2. Cria o ambiente virtual, se necessario ---
if not exist ".venv\Scripts\python.exe" (
  echo [setup] Criando ambiente virtual .venv ...
  %PYLAUNCH% -m venv .venv || goto :err
)
set "VENV_PY=.venv\Scripts\python.exe"

REM --- 3. Instala/atualiza dependencias ---
echo [setup] Instalando dependencias ...
"%VENV_PY%" -m pip install --upgrade pip >nul 2>nul
"%VENV_PY%" -m pip install -r requirements.txt || goto :err

REM --- 4. Wizard de provisionamento (grava o .env) ---
echo.
echo [setup] Provisionamento: informe a URL do Perseus, faca login e escolha
echo         criar uma nova runner ou usar uma existente (token).
echo.
"%VENV_PY%" -m runner.setup || goto :err

echo.
echo [setup] Concluido! A maquina esta configurada.
echo         Para subir a runner (ficar ONLINE no orquestrador), execute:  runner.bat
echo.
pause
goto :eof

:err
echo.
echo [setup] ERRO durante a configuracao. Veja as mensagens acima.
echo.
pause
exit /b 1
