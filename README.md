# Perseus

> **Orchestrate. Automate. Achieve.**

Plataforma de orquestração e automação de bots. Permite cadastrar automações,
versionar pacotes, conectar runners (máquinas) em tempo real, disparar tarefas
(manuais ou agendadas) e monitorar tudo num dashboard com ROI.

Veja a arquitetura completa em [`ARCHITECTURE.md`](./ARCHITECTURE.md) e a documentação técnica em [`docs/README.md`](./docs/README.md).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React + Vite + TypeScript + Tailwind + Recharts |
| Back-end | NestJS + Prisma + Socket.IO + BullMQ |
| Runner | Python |
| SDK | Python (`packages/sdk-python`) |
| Infra local | PostgreSQL + Redis + MinIO via Docker Compose |

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 20
- [Python](https://www.python.org/) >= 3.10
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## Inicio rapido

A forma mais simples de subir tudo de uma vez (Windows):

```powershell
.\start.ps1
```

O script verifica o Docker, sobe os containers, aplica migrations, cria o usuário admin e abre a API e o frontend em janelas separadas. Um `start.log` é gerado na raiz com o log completo da inicialização.

---

## Como rodar manualmente

### 1. Infraestrutura (Docker)

```bash
docker compose up -d
```

Sobe:
- Postgres em `localhost:5432` (user/pass: `perseus`/`perseus`, db: `perseus`)
- Redis em `localhost:6379`
- MinIO em `localhost:9000` (console: `http://localhost:9001`, `minioadmin`/`minioadmin`)
- Buckets `perseus-packages` e `perseus-artifacts` criados automaticamente

### 2. Backend (API)

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run -w apps/api prisma:migrate
npm run dev:api
```

API disponível em `http://localhost:3000/api`. Login padrão: `admin@local` / `admin123`.

Logs em `apps/api/logs/api.log`.

### 3. Front-end

```bash
cp apps/web/.env.example apps/web/.env
npm run dev:web
```

Web disponível em `http://localhost:5173`.

### 4. Runner

```bash
cd apps/runner
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # ajuste RUNNER_TOKEN (gerado no portal)
python -m runner.main
```

Logs em `apps/runner/logs/runner.log`.

### 5. SDK (instalação editável para os bots)

```bash
pip install -e packages/sdk-python
```

---

## Estrutura do pacote de um bot

```
meu-bot.zip
├── main.py            # ponto de entrada
├── requirements.txt   # dependências
├── bot.json           # manifesto (name, version, entrypoint, params)
└── resources/         # arquivos auxiliares (opcional)
```

Veja um exemplo completo em [`examples/hello-bot`](./examples/hello-bot).

---

## Fluxo de uso

1. Crie um **runner** no portal → copie o token → configure no agente Python.
2. Crie uma **automação** e faça **upload do `.zip`** (gera uma versão do robô).
3. Dispare uma **tarefa** (manual ou agende via cron).
4. O runner baixa o pacote, cria um venv, instala as dependências e executa.
5. O bot reporta status/itens/artefatos via SDK; acompanhe tudo no dashboard.

---

## Logs

| Componente | Arquivo |
|---|---|
| Inicialização | `start.log` (raiz do projeto) |
| API | `apps/api/logs/api.log` |
| API (erros) | `apps/api/logs/api-error.log` |
| Runner | `apps/runner/logs/runner.log` |
| Runner (erros) | `apps/runner/logs/runner-error.log` |
