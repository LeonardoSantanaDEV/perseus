# Runbook de Desenvolvimento

## 1. Setup rapido

Na raiz do projeto:

```bash
docker compose up -d
npm install
copy apps/api/.env.example apps/api/.env
copy apps/web/.env.example apps/web/.env
npm run -w apps/api prisma:migrate
npm run dev:api
npm run dev:web
```

Login padrao: `admin@local` / `admin123`.

## 2. Scripts uteis

- API dev: `npm run dev:api`
- Web dev: `npm run dev:web`
- Build API: `npm run build:api`
- Build Web: `npm run build:web`
- Build geral: `npm run build`

## 3. Validacao minima apos mudancas

1. Build API e Web.
2. Login no portal.
3. Criar runner.
4. Criar automacao.
5. Publicar pacote zip.
6. Disparar tarefa.
7. Verificar logs e artefatos.

## 4. Troubleshooting

### Erro de login "Credenciais invalidas"

Checklist:

- API no ar em `localhost:3000`.
- Seed executado.
- Email valido para regra de validacao.
- Sem conflito de versoes antigas da API.

### Porta ocupada

No Windows:

```powershell
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 5173
```

### API nao conecta no banco

- Verificar `apps/api/.env`.
- Confirmar `docker compose ps`.
- Testar se `orch_postgres` esta healthy.

### Runner nao fica online

- Verificar `RUNNER_TOKEN`.
- Verificar `ORCHESTRATOR_WS`.
- Confirmar namespace `/runner` ativo na API.

## 5. Procedimento para subir bot de exemplo

1. Criar runner no portal e copiar token.
2. Configurar `apps/runner/.env`.
3. Rodar runner:
   - `cd apps/runner`
   - `python -m venv .venv`
   - `.venv\\Scripts\\activate`
   - `pip install -r requirements.txt`
   - `python -m runner.main`
4. Zipar `examples/hello-bot` e publicar no portal.
5. Disparar tarefa e acompanhar em Tarefas.

## 6. Convencoes de documentacao

- Toda alteracao estrutural deve atualizar:
  - `ARCHITECTURE.md`
  - arquivos relevantes em `docs/`
- Novos endpoints devem ser refletidos em `docs/03-backend-api.md`.
