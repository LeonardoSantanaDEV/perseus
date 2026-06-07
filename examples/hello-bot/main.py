import time

from perseus_sdk import PerseusClient


def main():
    client = PerseusClient.from_env()
    client.start_task()

    params = client.get_params()
    quantidade = int(params.get("quantidade", 5))
    client.log(f"Iniciando processamento de {quantidade} itens")

    processados = 0
    falhas = 0
    for i in range(1, quantidade + 1):
        try:
            time.sleep(0.5)
            if i % 7 == 0:
                raise ValueError(f"item {i} inválido")
            client.log(f"Item {i}/{quantidade} processado com sucesso")
            processados += 1
        except Exception as e:  # noqa: BLE001
            falhas += 1
            client.error(e, context={"item": i})

    # Gera um artefato de exemplo
    with open("relatorio.txt", "w", encoding="utf-8") as f:
        f.write(f"Processados: {processados}\nFalhas: {falhas}\n")
    client.post_artifact("relatorio.txt")

    status = "SUCCESS" if falhas == 0 else "SUCCESS"
    client.finish_task(
        status=status,
        total_items=quantidade,
        processed=processados,
        failed=falhas,
        message=f"{processados} ok, {falhas} falhas",
    )
    print("Bot finalizado.")


if __name__ == "__main__":
    main()
