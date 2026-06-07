# Fluxogramas

## 1) Fluxo macro da plataforma

```mermaid
flowchart LR
    U[Usuario no Portal] --> FE[Front-end React]
    FE --> API[API NestJS]
    API --> DB[(PostgreSQL)]
    API --> OBJ[(MinIO/S3)]
    API <--> WS[(WebSocket)]
    R[Runner Python] <--> WS
    R --> BOT[Bot executado em venv]
    BOT --> SDK[SDK Python]
    SDK --> API
```

## 2) Fluxo de deploy de pacote

```mermaid
flowchart TD
    A[Usuario seleciona .zip] --> B[POST /api/automations/:id/versions]
    B --> C[API valida arquivo e bot.json]
    C --> D{Entrypoint existe?}
    D -- nao --> E[Rejeita upload 400]
    D -- sim --> F[Salva .zip no MinIO]
    F --> G[Cria BotVersion no PostgreSQL]
    G --> H[Retorna versao publicada]
```

## 3) Fluxo de execucao de tarefa

```mermaid
sequenceDiagram
    participant User as Usuario
    participant FE as Front-end
    participant API as API
    participant RUN as Runner
    participant BOT as Bot
    participant SDK as SDK

    User->>FE: Disparar tarefa
    FE->>API: POST /api/tasks
    API->>API: Cria Task (QUEUED)
    API->>RUN: task.dispatch (WebSocket)
    RUN->>API: task.accepted / task.started
    RUN->>RUN: baixa pacote + cria venv + instala deps
    RUN->>BOT: executa entrypoint
    BOT->>SDK: chamadas de status/log/erro/artefato
    SDK->>API: /api/sdk/tasks/*
    RUN->>API: task.finished (exitCode)
    API->>FE: task.update (WebSocket dashboard)
```

## 4) Fluxo de agendamento (cron)

```mermaid
flowchart TD
    A[Schedule salvo no banco] --> B[SchedulesService registra CronJob]
    B --> C[Horario disparado]
    C --> D[Cria Task automaticamente]
    D --> E[tryDispatch]
    E --> F{Runner disponivel?}
    F -- sim --> G[DISPATCHED/RUNNING]
    F -- nao --> H[Permanecer QUEUED ate runner online]
```

## 5) Fluxo de autenticacao

```mermaid
flowchart LR
    L[Login email/senha] --> A[POST /api/auth/login]
    A --> B{Credenciais validas?}
    B -- nao --> C[401/400]
    B -- sim --> D[JWT accessToken]
    D --> E[Front salva token]
    E --> F[Chamadas autenticadas]
```

## 6) Fluxo de heartbeat do runner

```mermaid
flowchart TD
    A[Runner conecta em /runner] --> B[Token validado]
    B --> C[Runner ONLINE]
    C --> D[Heartbeat periodico]
    D --> E[Atualiza lastSeen]
    E --> F{Sem heartbeat por N segundos?}
    F -- sim --> G[Marca OFFLINE]
    F -- nao --> D
```
