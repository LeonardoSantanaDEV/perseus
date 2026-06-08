# Provisionamento de Runner — Perseus

Guia passo a passo para colocar um runner Perseus em funcionamento em uma máquina
remota (VM, EC2, VPS, servidor físico) e fazê-lo subir automaticamente no boot.

---

## Pré-requisitos da máquina

| Item | Versão mínima |
|---|---|
| Python | 3.10+ |
| RAM | 2 GB (4 GB para bots com browser) |
| Disco | 10 GB livres (bots com browser consomem mais durante a execução) |
| Rede | Acesso de **saída** para o Perseus (HTTP/HTTPS + WebSocket) e para o S3/MinIO |
| OS | Windows 10/11/Server 2019+ · Ubuntu 20.04+ · Debian 11+ |

Portas de **entrada** não são necessárias — o runner sempre inicia a conexão.

---

## 1. Gerar o token no portal

1. Acesse o Perseus → **Runners** → **Novo Runner**.
2. Dê um nome que identifique a máquina (ex: `MDBWINRPA01`, `EC2-SA-EAST-1-A`).
3. **Copie o token imediatamente** — ele aparece apenas uma vez.

---

## 2. Instalar o runner

### Windows

```powershell
# Abra o PowerShell como Administrador

# 1. Clone ou copie a pasta apps/runner para a máquina.
#    Exemplo baixando direto do GitHub (ajuste a URL):
git clone https://github.com/SEU-USUARIO/Perseus.git C:\Perseus
# Ou copie manualmente a pasta apps/runner para C:\Perseus\runner

cd C:\Perseus\apps\runner

# 2. Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Configurar .env
copy .env.example .env
notepad .env
```

Edite o `.env` com os valores da sua instalação:

```env
PERSEUS_WS=https://seu-perseus.exemplo.com
PERSEUS_API=https://seu-perseus.exemplo.com/api
RUNNER_TOKEN=rnr_xxxxxxxxxxxxxxxxxxxx
HEARTBEAT_INTERVAL=10
WORK_DIR=C:\Perseus\runner\_work
PYTHON_BIN=python
SDK_PATH=C:\Perseus\packages\sdk-python
KEEP_WORK_DIR=false
```

### Linux (Ubuntu/Debian)

```bash
# 1. Instalar dependências do sistema
sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip git

# 2. Clonar o repositório (ou copiar só a pasta apps/runner)
git clone https://github.com/SEU-USUARIO/Perseus.git /opt/perseus
cd /opt/perseus/apps/runner

# 3. Criar ambiente virtual
python3 -m venv .venv
source .venv/bin/activate

# 4. Instalar dependências
pip install -r requirements.txt

# 5. Configurar .env
cp .env.example .env
nano .env
```

```env
PERSEUS_WS=https://seu-perseus.exemplo.com
PERSEUS_API=https://seu-perseus.exemplo.com/api
RUNNER_TOKEN=rnr_xxxxxxxxxxxxxxxxxxxx
HEARTBEAT_INTERVAL=10
WORK_DIR=/opt/perseus/runner/_work
PYTHON_BIN=python3
SDK_PATH=/opt/perseus/packages/sdk-python
KEEP_WORK_DIR=false
```

---

## 3. Testar manualmente

Antes de registrar como serviço, confirme que funciona:

```bash
# Linux
cd /opt/perseus/apps/runner
source .venv/bin/activate
python3 -m runner.main
```

```powershell
# Windows
cd C:\Perseus\apps\runner
.venv\Scripts\activate
python -m runner.main
```

Você deve ver:

```
=== Perseus Runner =========================
Configuração carregada. PERSEUS_WS=https://...
Perseus Runner iniciando. Host=NOME-VM OS=...
Conectando em https://... ...
Conectado ao Perseus em https://...
```

E no portal, o runner aparece como **ONLINE**. Se aparecer, passe para o passo 4.

---

## 4. Registrar como serviço (inicia no boot)

### Windows — Task Scheduler

```powershell
# Cria uma tarefa agendada que inicia o runner no boot como SYSTEM
$action  = New-ScheduledTaskAction `
    -Execute "C:\Perseus\apps\runner\.venv\Scripts\python.exe" `
    -Argument "-m runner.main" `
    -WorkingDirectory "C:\Perseus\apps\runner"

$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName "Perseus Runner" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

# Iniciar imediatamente sem precisar reiniciar
Start-ScheduledTask -TaskName "Perseus Runner"
```

Para verificar:

```powershell
Get-ScheduledTask -TaskName "Perseus Runner" | Select-Object State, LastRunTime
```

Para parar/remover:

```powershell
Stop-ScheduledTask  -TaskName "Perseus Runner"
Unregister-ScheduledTask -TaskName "Perseus Runner" -Confirm:$false
```

---

### Linux — systemd

```bash
# Cria o arquivo de serviço
sudo tee /etc/systemd/system/perseus-runner.service > /dev/null << 'EOF'
[Unit]
Description=Perseus Runner Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/perseus/apps/runner
EnvironmentFile=/opt/perseus/apps/runner/.env
ExecStart=/opt/perseus/apps/runner/.venv/bin/python3 -m runner.main
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Habilitar e iniciar
sudo systemctl daemon-reload
sudo systemctl enable perseus-runner
sudo systemctl start  perseus-runner

# Verificar status
sudo systemctl status perseus-runner

# Ver logs em tempo real
sudo journalctl -u perseus-runner -f
```

> **Nota:** Se os bots precisarem de acesso a display (bots de desktop/browser não-headless),
> troque `User=nobody` pelo usuário que tem sessão gráfica e adicione
> `Environment=DISPLAY=:0` no `[Service]`.

---

## 5. Atualizar o runner

Quando houver nova versão do código do runner:

```bash
# Linux
cd /opt/perseus
git pull
source apps/runner/.venv/bin/activate
pip install -r apps/runner/requirements.txt
sudo systemctl restart perseus-runner
```

```powershell
# Windows
cd C:\Perseus
git pull
.venv\Scripts\activate
pip install -r apps\runner\requirements.txt
Stop-ScheduledTask  -TaskName "Perseus Runner"
Start-ScheduledTask -TaskName "Perseus Runner"
```

---

## 6. Revogar/trocar o token de uma máquina

Se a VM for comprometida ou precisar ser rotacionada:

1. No portal Perseus → **Runners** → ícone de **Regenerar token** na linha do runner.
2. Copie o novo token do banner que aparece.
3. Na VM: edite o `.env` e substitua `RUNNER_TOKEN`.
4. Reinicie o serviço (`systemctl restart perseus-runner` / `Stop/Start-ScheduledTask`).

O token antigo é inválido imediatamente após a regeneração.

---

## 7. Troubleshooting

| Sintoma | O que verificar |
|---|---|
| Runner não aparece como ONLINE | `PERSEUS_WS` aponta para o host/porta correto? A máquina alcança o Perseus? (`curl https://seu-perseus.exemplo.com/api`) |
| "RUNNER_TOKEN não configurado" | Arquivo `.env` está na pasta correta e com o token preenchido? |
| Tarefa fica em QUEUED para sempre | O runner está ONLINE? Há versão publicada para a automação? |
| Bot falha ao instalar dependências | Máquina tem acesso à internet para `pip install`? Verificar `_work/<taskId>/` para logs de instalação |
| Disco enchendo | `KEEP_WORK_DIR=false` no `.env`? O sweeper limpa após cada tarefa |
| Runner fica OFFLINE rapidamente | Link instável? Aumente `RUNNER_OFFLINE_AFTER_SECONDS` na API (ex: 60) |

Logs do runner ficam em:

```
# Linux
/opt/perseus/apps/runner/logs/runner.log
/opt/perseus/apps/runner/logs/runner-error.log

# Windows
C:\Perseus\apps\runner\logs\runner.log
C:\Perseus\apps\runner\logs\runner-error.log
```

---

## 8. Checklist por máquina nova

- [ ] Python 3.10+ instalado
- [ ] `.venv` criado e dependências instaladas
- [ ] `.env` configurado (`PERSEUS_WS`, `PERSEUS_API`, `RUNNER_TOKEN`)
- [ ] Teste manual passou (runner aparece ONLINE no portal)
- [ ] Serviço registrado (Task Scheduler / systemd)
- [ ] Serviço inicia sozinho após reiniciar a VM (validar com reboot)
- [ ] Token copiado e guardado em cofre (ex: AWS Secrets Manager, 1Password)

---

_Perseus — Plataforma de orquestração de bots._
