# orchestrator-sdk

SDK Python para conectar bots ao **Bot Orchestrator** (estilo BotCity Maestro).

## Instalação

```bash
pip install -e packages/sdk-python
```

Ou inclua `orchestrator-sdk` no `requirements.txt` do seu bot.

## Uso

```python
from orchestrator_sdk import Maestro

maestro = Maestro.from_env()
maestro.start_task()

params = maestro.get_params()
maestro.log(f"Iniciando com parâmetros: {params}")

try:
    total, processados, falhas = 0, 0, 0
    # ... lógica do bot ...
    maestro.post_artifact("relatorio.xlsx")
    maestro.finish_task(
        status="SUCCESS",
        total_items=total,
        processed=processados,
        failed=falhas,
    )
except Exception as e:
    maestro.error(e)
    maestro.finish_task(status="FAILED")
```

## Variáveis de ambiente (injetadas pelo runner)

- `ORCHESTRATOR_URL` — URL base da API
- `TASK_ID` — id da tarefa
- `TASK_TOKEN` — token de autenticação da tarefa
- `ORCH_PARAMS` — JSON com os parâmetros da tarefa

Se essas variáveis não existirem, o SDK roda em **modo offline** (apenas imprime),
permitindo testar o bot localmente.
