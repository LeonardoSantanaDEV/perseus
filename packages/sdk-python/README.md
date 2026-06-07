# perseus-sdk

SDK Python para conectar bots ao **Perseus**.

## Instalação

```bash
pip install -e packages/sdk-python
```

Ou inclua `perseus-sdk` no `requirements.txt` do seu bot.

## Uso

```python
from perseus_sdk import PerseusClient

client = PerseusClient.from_env()
client.start_task()

params = client.get_params()
client.log(f"Iniciando com parâmetros: {params}")

try:
    total, processados, falhas = 0, 0, 0
    # ... lógica do bot ...
    client.post_artifact("relatorio.xlsx")
    client.finish_task(
        status="SUCCESS",
        total_items=total,
        processed=processados,
        failed=falhas,
    )
except Exception as e:
    client.error(e)
    client.finish_task(status="FAILED")
```

## Variáveis de ambiente (injetadas pelo runner)

- `PERSEUS_URL` — URL base da API
- `TASK_ID` — id da tarefa
- `TASK_TOKEN` — token de autenticação da tarefa
- `PERSEUS_PARAMS` — JSON com os parâmetros da tarefa

Se essas variáveis não existirem, o SDK roda em **modo offline** (apenas imprime),
permitindo testar o bot localmente.
