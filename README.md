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

**Servidor** (API + Web + infra) — basta o Docker:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + Compose v2)

**Máquina runner** (onde os bots executam) — fica fora do Docker:

- [Python](https://www.python.org/) >= 3.10

> O desenvolvimento manual sem containers (modo dev) ainda exige Node.js >= 20.
> Veja [Modo dev (sem containers)](#modo-dev-sem-containers).

---

## Inicio rapido (Docker)

A stack inteira (Postgres + Redis + MinIO + **API** + **Web**) sobe com um comando.

```bash
cp .env.example .env          # copy .env.example .env  (Windows)
docker compose up -d --build
```

Pronto:

| Serviço | Endereço | Credenciais |
|---|---|---|
| Web | `http://localhost:8080` | `admin@local` / `admin123` |
| API | `http://localhost:3000/api` | — |
| MinIO console | `http://localhost:9001` | `minioadmin` / `minioadmin` |

O container da API aplica as migrations e roda o seed (usuário admin + buckets)
**automaticamente** no boot. Tudo é idempotente:

| Situação | Comando |
|---|---|
| Primeira execução | `docker compose up -d --build` |
| Execuções seguintes | `docker compose up -d` |
| Após mudar o código | `docker compose up -d --build` |
| Reset total (apaga dados) | `docker compose down -v` |

Ajuste segredos (JWT, senha do admin, chaves do MinIO, portas) no `.env` da raiz —
veja [`.env.example`](./.env.example). Em `NODE_ENV=production` a API recusa subir
com segredos padrão.

---

## Runner

O runner é um agente que roda **na máquina que vai executar os bots** (VM, VPS,
servidor físico), separado da stack Docker. Configuração inicial via wizard:

```bash
cd apps/runner
python -m venv .venv
.venv\Scripts\activate         # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt

python -m runner.setup         # wizard: login -> nova/existente -> grava o token
```

O wizard pede a URL do Perseus, autentica com seu **login/senha** e então:

- **Nova runner** — cria a runner no portal e **salva o token automaticamente**
  (requer usuário ADMIN ou OPERATOR).
- **Runner existente** — você cola o token da máquina (obtido com o administrador).

Depois, inicie o agente (e registre como serviço para subir no boot — veja
[`docs/07-provisionamento-runner.md`](./docs/07-provisionamento-runner.md)):

```bash
python -m runner.main
```

Logs em `apps/runner/logs/runner.log`.

### SDK (instalação editável para os bots)

```bash
pip install -e packages/sdk-python
```

---

## Modo dev (sem containers)

Para desenvolver a API/Web com hot-reload, rodando apenas a infra em Docker:

```bash
docker compose up -d postgres redis minio minio-init   # só a infra
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run -w apps/api prisma:migrate
npm run dev:api      # http://localhost:3000/api
npm run dev:web      # http://localhost:5173
```

No Windows, o script [`start.ps1`](./start.ps1) automatiza esse fluxo de dev
(sobe a infra, instala deps, migra, faz seed e abre API + Web em janelas).

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

1. Provisione um **runner** numa máquina com `python -m runner.setup` (login → nova/existente).
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
