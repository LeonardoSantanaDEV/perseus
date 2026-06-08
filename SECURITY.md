# Segurança — Perseus

Este documento descreve o modelo de segurança da plataforma Perseus, como os
dados são tratados, as vulnerabilidades conhecidas e o que precisa ser feito
antes de um deploy em produção.

> **Status atual:** o projeto está em estágio de desenvolvimento. Vários valores
> padrão são inseguros **por design** (para facilitar o setup local) e **não
> devem** ir para produção sem as correções listadas aqui.

---

## 1. Arquitetura e superfícies de ataque

```
Navegador (Web)  ──HTTPS/JWT──►  API NestJS  ──►  PostgreSQL
                                    │
                                    ├──►  MinIO/S3  (pacotes .zip e artefatos)
                                    │
                                    └──WebSocket(/runner)──►  Runners (executam Python arbitrário)
```

Superfícies expostas:

| Superfície | Autenticação | Observações |
|---|---|---|
| `POST /api/auth/login` | — (pública) | Sem rate limit |
| `POST /api/auth/register` | **— (pública!)** | Ver risco crítico #2 |
| Demais rotas REST `/api/*` | JWT (Bearer) | Filtragem por `workspaceId` |
| Rotas SDK `/api/sdk/tasks/*` | Task Token (JWT `typ=task`) | Usado pelo bot |
| WebSocket `/runner` | Token do runner (`rnr_…`) | `cors.origin: '*'` |
| WebSocket `/dashboard` | — | `cors.origin: '*'` |
| MinIO (9000/9001) | Credenciais S3 | URLs pré-assinadas |

---

## 2. Como os dados são tratados

### Credenciais de usuário
- Senhas são armazenadas com **bcrypt** (cost 10) — `auth.service.ts`. Nunca em texto puro. ✔️
- Login compara via `bcrypt.compare`. ✔️

### Tokens
- **JWT de usuário**: assinado com `JWT_SECRET`, expira em `JWT_EXPIRES_IN` (7d). Carrega `sub`, `email`, `role`, `workspaceId`.
- **Task Token**: JWT com `typ=task`, expira em `TASK_TOKEN_EXPIRES_IN` (12h). Injetado no ambiente do bot (`TASK_TOKEN`) e dá acesso aos endpoints `/sdk/tasks/*` daquela tarefa.
- **Token de runner**: string aleatória de 24 bytes (`rnr_` + hex, via `crypto.randomBytes`). Boa entropia ✔️, mas **armazenado em texto puro** no banco e **exibido na UI**.

### Isolamento multi-tenant
- Todas as consultas REST filtram por `workspaceId` derivado do JWT. ✔️ Bom isolamento lógico entre workspaces.
- Endpoints do SDK operam pelo `taskId` embutido no token (escopo correto). ✔️

### Armazenamento de objetos
- Pacotes (`.zip`) e artefatos ficam no MinIO/S3.
- Downloads usam **URLs pré-assinadas** com expiração: pacotes 1h, artefatos 10min. ✔️
- Parâmetros da tarefa (`params`) e logs são persistidos no Postgres — **podem conter dados sensíveis** se o operador passar segredos como parâmetro.

---

## 3. Vulnerabilidades e riscos conhecidos

### 🔴 Crítico

**#1 — Segredos padrão (`dev-secret`, credenciais triviais)**
- `JWT_SECRET` tem fallback hardcoded `'dev-secret'` em `jwt.strategy.ts` e `task-token.guard.ts`. Se a env não for definida em produção, **qualquer pessoa pode forjar JWTs** e se passar por ADMIN → bypass total de autenticação.
- Outros padrões fracos: admin `admin@local / admin123`, MinIO `minioadmin/minioadmin`, Postgres `perseus/perseus`.
- **Ação:** exigir `JWT_SECRET` forte (≥32 bytes aleatórios) e falhar o boot se ausente; trocar todas as credenciais padrão.

**#2 — Registro de usuário público + cadeia para RCE**
- `POST /api/auth/register` **não tem guard** (`auth.controller.ts`). Qualquer um cria uma conta com role `OPERATOR` (padrão do schema).
- OPERATOR pode publicar pacotes de bot → e bots executam **código Python arbitrário** nos runners.
- **Resultado:** um atacante anônimo pode obter execução remota de código (RCE) em todas as máquinas runner.
- **Ação:** proteger `register` (somente ADMIN), ou removê-lo, ou exigir convite. Revisar o role padrão.

**#3 — Execução de código arbitrário nos runners (risco inerente)**
- O runner baixa um `.zip`, roda `pip install` de dependências arbitrárias e executa o entrypoint via `subprocess` (`executor.py`), **sem sandbox**, com o usuário do SO do runner.
- Quem consegue publicar um bot controla totalmente o runner (ler segredos do host, pivotar na rede, etc.).
- **Ação:** rodar cada runner em **container/VM isolada e descartável**, com usuário sem privilégios, sistema de arquivos efêmero, e **restrição de egresso de rede**. Nunca colocar segredos de outros sistemas na máquina do runner. Considerar lista de dependências permitidas.

### 🟠 Alto

**#4 — CORS aberto nos WebSockets**
- `@WebSocketGateway({ cors: { origin: '*' } })` nos gateways `/runner` e `/dashboard`.
- O namespace `/dashboard` **não autentica** a conexão.
- **Ação:** restringir `origin` à origem do front; autenticar o namespace `/dashboard` com JWT no handshake.

**#5 — Token de runner em texto puro**
- Armazenado sem hash no banco e exibido na tela de Runners.
- **Ação:** armazenar apenas o hash do token (comparar por hash no handshake); exibir o valor só uma vez na criação.

**#6 — Sem rate limiting / proteção contra brute force**
- `/auth/login` aceita tentativas ilimitadas.
- **Ação:** adicionar `@nestjs/throttler` no login e nos endpoints sensíveis.

### 🟡 Médio

**#7 — Zip Slip (path traversal na extração)**
- `executor.py` faz `zip.extractall(src_dir)`. O `zipfile` do Python moderno neutraliza caminhos absolutos e `..`, mas links simbólicos dentro do zip ainda podem ser um vetor.
- **Ação:** validar cada entrada antes de extrair (rejeitar `..`, caminhos absolutos e symlinks).

**#8 — Sem TLS na camada da aplicação**
- API e MinIO sobem em HTTP. URLs pré-assinadas podem sair em `http://`.
- **Ação:** terminar TLS num proxy reverso (Nginx/ALB) e usar `S3_PUBLIC_ENDPOINT` em HTTPS.

**#9 — Upload sem verificação de conteúdo**
- Pacotes até 200MB, artefatos até 100MB; sem antivírus / inspeção. Risco de DoS de disco e de conteúdo malicioso.
- **Ação:** cotas por workspace, limpeza/retenção, varredura opcional.

**#10 — Sem timeout de tarefa**
- O enum `TIMEOUT` existe, mas nenhuma rotina finaliza tarefas presas em `DISPATCHED`/`RUNNING`. Um bot travado mantém o runner `BUSY` para sempre.
- **Ação:** sweeper que expira tarefas que excedem um tempo máximo (e libera o runner).

### 🟢 Baixo / Higiene

- **#11** `forbidNonWhitelisted: false` — propriedades extras são removidas, mas não rejeitadas. Considerar `true`.
- **#12** Logs e `params` podem capturar dados sensíveis (stdout do bot, segredos passados como parâmetro). Definir política de mascaramento/retenção.
- **#13** Mensagens de log são renderizadas no front — manter escape padrão do React (não usar `dangerouslySetInnerHTML` no terminal de logs).
- **#14** Dependências sem verificação de integridade (`pip install` sem hashes). Considerar `--require-hashes`.

---

## 4. Checklist de hardening para produção

Já corrigido no código:

- [x] `JWT_SECRET` forte e obrigatório — boot falha em produção se ausente/fraco/curto (`config/security.ts`)
- [x] `POST /auth/register` protegido (somente ADMIN autenticado)
- [x] `cors.origin` restrito a `WEB_ORIGIN`; namespace `/dashboard` agora exige JWT
- [x] Rate limiting no login (`LoginThrottleGuard`, em memória)
- [x] Validação anti Zip-Slip/symlink na extração do pacote (`executor.py`)
- [x] Timeout de tarefas (`sweepStuckTasks`) → marca `TIMEOUT` e libera o runner
- [x] `forbidNonWhitelisted: true` no ValidationPipe
- [x] Validação de credenciais padrão no boot (S3/admin) em produção
- [x] Limpeza do `work_dir` por tarefa (evita encher disco em 24/7)
- [x] **Token de runner armazenado como hash (SHA-256)** — texto puro exibido só uma vez na criação/regeneração (`token.util.ts`, migração `runner_token_hash`)

Pendente (operacional / requer migração):

- [ ] Trocar senhas padrão: admin, Postgres, MinIO (deploy)
- [ ] Revisar role padrão de novos usuários (hoje OPERATOR)
- [ ] Runners em containers/VMs isoladas, usuário sem privilégios, FS efêmero
- [ ] Restringir egresso de rede dos runners
- [ ] TLS em tudo (API, MinIO, downloads pré-assinados) — proxy reverso
- [ ] Política de retenção/mascaramento de logs e parâmetros
- [ ] Backups do Postgres e do MinIO
- [ ] Rate limiter compartilhado (Redis) se a API rodar em múltiplas instâncias

---

## 5. Como reportar uma vulnerabilidade

Reporte de forma privada ao responsável pelo projeto (não abra issue pública
com detalhes de exploração). Inclua: descrição, passos de reprodução, impacto e,
se possível, uma sugestão de correção.

---

_Última atualização: 2026-06-08._
