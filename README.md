# Perseus

> **Orchestrate. Automate. Achieve.**

Plataforma de orquestração e automação de bots. Permite cadastrar automações,
versionar pacotes, conectar runners (máquinas) em tempo real, disparar tarefas
(manuais ou agendadas) e monitorar tudo num dashboard com ROI — com **controle de
acesso por grupos** (usuários, grupos e repositórios) e Funções.

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

> **Conflito de porta?** Se aparecer `Bind for 0.0.0.0:8080 failed: port is already
> allocated`, a porta já está em uso por outro serviço no host. Troque a porta no
> `.env` da raiz e rode `docker compose up -d` de novo:
> - **Web** — ajuste `WEB_PORT` **e** `WEB_ORIGIN` juntos (o `WEB_ORIGIN` precisa
>   apontar para a nova porta, ex.: `WEB_PORT=8081` e `WEB_ORIGIN=http://localhost:8081`,
>   senão o login falha por CORS e os links de confirmação saem errados).
> - Outras portas: `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_PORT`,
>   `MINIO_CONSOLE_PORT`.
>
> Para descobrir quem ocupa a porta: `docker ps --filter "publish=8080"` (container)
> ou, no Windows, `Get-NetTCPConnection -LocalPort 8080`.

---

## Runner

O runner é um agente que roda **na máquina que vai executar os bots** (VM, VPS,
servidor físico), separado da stack Docker. Único pré-requisito: **Python 3.10+**
instalado e no PATH.

Copie a pasta [`apps/runner`](./apps/runner) (e [`packages/sdk-python`](./packages/sdk-python),
mantendo a estrutura do repositório) para a máquina e rode **dois passos**:

### 1. Configurar a máquina (uma vez) — `setup`

Cria o ambiente virtual, instala as dependências e roda o wizard de provisionamento.

```bat
:: Windows  (dê duplo clique ou rode no terminal)
setup.bat
```

```bash
# Linux / macOS
chmod +x setup.sh runner.sh && ./setup.sh
```

O wizard pede a **URL do Perseus**, autentica com seu **login/senha** e oferece:

- **Nova runner** — cria a runner no portal e **salva o token automaticamente**
  (requer usuário com Função **ADMINISTRADOR** ou **OPERADOR**).
- **Runner existente** — você cola o token da máquina (obtido com o administrador).

### 2. Subir a runner (ficar ONLINE) — `runner`

Conecta ao Perseus e deixa a máquina **disponível** no orquestrador, pronta para
receber tarefas. Mantenha o processo rodando.

```bat
:: Windows
runner.bat
```

```bash
# Linux / macOS
./runner.sh
```

Para subir no boot, registre como serviço (Windows: NSSM / Agendador de Tarefas;
Linux: `systemd`) — veja [`docs/07-provisionamento-runner.md`](./docs/07-provisionamento-runner.md).
Logs em `apps/runner/logs/runner.log`.

> **Passo manual (alternativo aos scripts):**
> ```bash
> cd apps/runner
> python -m venv .venv && .venv\Scripts\activate   # Linux/Mac: source .venv/bin/activate
> pip install -r requirements.txt
> python -m runner.setup     # provisiona (.env)
> python -m runner.main      # sobe a runner
> ```

> **SDK dos bots:** o runner instala o SDK automaticamente no venv de cada bot, a
> partir do caminho `SDK_PATH` do [`.env`](./apps/runner/.env.example) (padrão
> `../../packages/sdk-python`). Por isso a pasta `packages/sdk-python` precisa existir
> na máquina. Para desenvolver bots localmente: `pip install -e packages/sdk-python`.

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

## Reportando itens e resultado (SDK)

No fim da execução, o bot informa ao Perseus **quantos itens processou, quantos
falharam, o total e uma mensagem-resumo** — tudo numa única chamada `finish_task`
do SDK. Esses valores aparecem no **detalhe da tarefa**, e `processed` alimenta o
**ROI** da Central de Operações.

Padrão recomendado: conte por item dentro do loop e finalize **uma vez** no fim.

```python
from perseus_sdk import PerseusClient

client = PerseusClient.from_env()
client.start_task()

itens = [...]               # o que o bot vai processar (linhas, registros, e-mails…)
total = len(itens)          # 1) TOTAL de itens
processed = 0               # 2) itens PROCESSADOS (sucesso)
failed = 0                  # 3) itens com FALHA

for item in itens:
    try:
        # ... processa o item ...
        processed += 1
        client.log(f"Item OK: {item}")
    except Exception as e:
        failed += 1
        client.error(e, context={"item": item})         # registra um evento de ERRO
        client.log(f"Item falhou: {e}", level="error")

# Status final: SUCCESS se nada falhou; senão FAILED
status = "SUCCESS" if failed == 0 else "FAILED"

client.finish_task(
    status=status,                                       # "SUCCESS" | "FAILED"
    total_items=total,                                   # 1) total de itens
    processed=processed,                                 # 2) processados (sucesso)
    failed=failed,                                       # 3) falhas
    message=f"{processed}/{total} processados, {failed} falhas",  # 4) MENSAGEM-resumo
)
```

| Configuração | Parâmetro de `finish_task` | Onde aparece |
|---|---|---|
| Total de itens | `total_items` | Detalhe da tarefa |
| Itens processados | `processed` | Detalhe da tarefa + **ROI** |
| Itens com falha | `failed` | Detalhe da tarefa |
| Mensagem final | `message` | Detalhe da tarefa (resumo) |

> Chame `finish_task` **uma única vez**, ao final. As mensagens ao longo da execução
> vão por `client.log(...)` (logs) e `client.error(...)` (eventos de erro) — separadas
> do `message` final, que é o resumo único. Veja o exemplo completo em
> [`examples/rpa-challenge/main.py`](./examples/rpa-challenge/main.py).

---

## Fluxo de uso

1. Provisione um **runner** numa máquina com `python -m runner.setup` (login → nova/existente).
2. Crie uma **automação** e faça **upload do `.zip`** (gera uma versão do robô).
3. Dispare uma **tarefa** (manual ou agende via cron).
4. O runner baixa o pacote, cria um venv, instala as dependências e executa.
5. O bot reporta status/itens/artefatos via SDK; acompanhe tudo no dashboard.

---

## Controle de acessos

A aba **Acessos** (visível apenas para a Função **ADMINISTRADOR**) centraliza a
liberação de acesso por **grupos**, em três abas:

- **Usuários** — adicione usuários por e-mail (cria já ativo e envia um link de
  confirmação para definir a senha), exclua, reenvie o link e defina os **grupos**
  de cada usuário.
- **Grupos de Acessos** — crie grupos e selecione os **repositórios** que cada um libera.
- **Repositórios** — associe cada automação a um repositório (selecione a automação,
  depois o repositório).

A hierarquia é **Usuário → Grupo de Acesso → Repositório → Automação**. Quem não é
ADMINISTRADOR só enxerga — em **Automações**, **Tarefas**, **Agendamentos** e na
**Central de Operações** — o que pertence aos seus grupos. O grupo e o repositório
**DEFAULT** são criados no seed e ficam sempre vinculados entre si.

### Funções

`OPERADOR`, `DESENVOLVEDOR`, `GERENTE` e `ADMINISTRADOR`. Por enquanto a única regra
por Função é que **somente ADMINISTRADOR** acessa a aba Acessos; as demais áreas são
visíveis a todas as Funções (com o conteúdo filtrado pelos grupos).

### E-mail de confirmação (convite)

Configure o SMTP em [`apps/api/.env`](./apps/api/.env.example) (`SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) e o `APP_URL`
(base do front usada nos links). **Sem `SMTP_HOST`**, o link de confirmação é apenas
registrado no log e exibido na tela (fallback de desenvolvimento); quando `APP_URL`
não está definido, o link usa o `WEB_ORIGIN`.

---

## Fila (banco externo)

A tela **Fila** mostra os itens (`item_run`) de uma fila lida de um **banco
Postgres externo, somente leitura** — separado do banco do Perseus. **Precisa ser
configurada em cada ambiente** onde o Perseus for instalado.

### 1. Apontar o banco da fila

No `.env` da **raiz** (lido pelo docker-compose), defina a connection string do
banco (use um usuário **somente leitura**) e, se necessário, os ajustes:

```bash
QUEUE_DATABASE_URL=postgresql://usuario_ro:senha@host-do-banco:5432/orquestrador
QUEUE_DATE_COLUMN=created_at      # coluna p/ janela de histórico + ordenação (DESC)
QUEUE_HISTORY_DAYS=30             # histórico inicial (dias)
QUEUE_PAGE_SIZE=25                # itens por página
QUEUE_STATEMENT_TIMEOUT_MS=8000   # timeout de cada consulta
```

Recrie só a API (mudança de env, **sem rebuild**):

```bash
docker compose up -d api
```

> **Modo dev (sem Docker):** coloque as mesmas variáveis em `apps/api/.env` e
> reinicie a API. Sem `QUEUE_DATABASE_URL`, a tela mostra "banco da fila não
> configurado". Veja [`apps/api/.env.example`](./apps/api/.env.example).

### 2. Como o banco precisa estar organizado

- **1 schema por automação**, com o **nome do schema = `label` da automação** no
  Perseus. Schemas sem automação correspondente (ou fora do grupo de acesso do
  usuário) não aparecem.
- Cada schema tem uma tabela **`item_run`** com as colunas padrão:
  `item_id, run_id, process_name, item_key, area, priority, status, tags,
  resource_name, attempt, payload, started_at, last_updated_at, next_review_at,
  completed_at, total_work_time, exception_at, exception_reason`.
- Mais a coluna usada em `QUEUE_DATE_COLUMN` (padrão `created_at`) para a janela de
  histórico e a ordenação (`DESC`). Se a tabela não tiver `created_at`, ajuste
  `QUEUE_DATE_COLUMN` para uma coluna de data existente (ex.: `started_at`).

### 3. Comportamento

- **Gating por acesso**: cada usuário só vê os schemas cujo `label` de automação
  está no(s) seu(s) grupo(s); **ADMINISTRADOR** vê todos os que têm automação
  correspondente.
- **Somente leitura** — nada é escrito no banco externo.
- **Atualização manual**: o botão **Atualizar** abre um pop-up de confirmação e só
  então recarrega (sem polling). Paginação de 25 itens e caixa de busca por schema.

---

## Logs

| Componente | Arquivo |
|---|---|
| Inicialização | `start.log` (raiz do projeto) |
| API | `apps/api/logs/api.log` |
| API (erros) | `apps/api/logs/api-error.log` |
| Runner | `apps/runner/logs/runner.log` |
| Runner (erros) | `apps/runner/logs/runner-error.log` |
