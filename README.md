# Perseus

Plataforma de orquestração e automação de bots. Permite cadastrar
automações, versionar pacotes, conectar runners (máquinas) em tempo real,
disparar tarefas (manuais ou agendadas) e monitorar tudo num dashboard com ROI.

Veja a arquitetura completa em [`ARCHITECTURE.md`](./ARCHITECTURE.md) e a documentacao tecnica detalhada em [`docs/README.md`](./docs/README.md).

## Stack

- **Front-end:** React + Vite + TypeScript + Tailwind + Recharts (`apps/web`)
- **Back-end:** NestJS + Prisma + Socket.IO + BullMQ (`apps/api`)
- **Runner:** Python (`apps/runner`)
- **SDK:** Python (`packages/sdk-python`)
- **Infra local:** PostgreSQL + Redis + MinIO via Docker Compose

## Pré-requisitos

- Node.js >= 20
- Python >= 3.10
- Docker (para Postgres / Redis / MinIO locais)

## Como rodar (local-first)

### 1. Subir a infraestrutura

```bash
docker compose up -d
```

Isso sobe:
- Postgres em `localhost:5432` (user/pass: `perseus`/`perseus`, db `perseus`)
- Redis em `localhost:6379`
- MinIO em `localhost:9000` (console em `http://localhost:9001`, `minioadmin`/`minioadmin`)
- Buckets `perseus-packages` e `perseus-artifacts` criados automaticamente

### 2. Backend (API)

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run -w apps/api prisma:migrate   # cria o schema + seed do usuário admin
npm run dev:api
```

API sobe em `http://localhost:3000`. Usuário seed: `admin@local` / `admin123`.

### 3. Front-end

```bash
cp apps/web/.env.example apps/web/.env
npm run dev:web
```

Web sobe em `http://localhost:5173`.

### 4. Runner

```bash
cd apps/runner
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # ajuste RUNNER_TOKEN (gerado no portal)
python -m runner.main
```

### 5. SDK (instalação editável, para os bots)

```bash
pip install -e packages/sdk-python
```

## Estrutura do pacote de um bot

```
meu-bot.zip
├── main.py            # ponto de entrada
├── requirements.txt   # dependências
├── bot.json           # manifesto (name, version, entrypoint, params)
└── resources/         # arquivos auxiliares (opcional)
```

Veja um exemplo completo em [`examples/hello-bot`](./examples/hello-bot).

## Fluxo de uso

1. Crie um **runner** no portal → copie o token → configure no agente Python.
2. Crie uma **automação** e faça **upload do `.zip`** (gera uma versão do robô).
3. Dispare uma **tarefa** (manual ou agende via cron).
4. O runner baixa o pacote, cria um venv, instala as dependências e executa.
5. O bot reporta status/itens/artefatos via SDK; acompanhe tudo no dashboard.
