"""
RPA Challenge Bot
-----------------
Acessa https://rpachallenge.com, baixa a planilha challenge.xlsx,
e preenche o formulário para todos os registros.

Os campos do formulário trocam de posição a cada submissão —
por isso mapeamos pelo atributo ng-reflect-name, não pela posição.
"""

import os
import subprocess
import sys

import requests
import openpyxl
from perseus_sdk import PerseusClient


# ---------------------------------------------------------------------------
# Garante que os browsers do Playwright estão instalados no venv corrente
# ---------------------------------------------------------------------------
def ensure_playwright_browsers():
    try:
        subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium", "--with-deps"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"[warn] playwright install: {e.stderr}")


# ---------------------------------------------------------------------------
# Mapeamento dos campos do desafio
# Cada key é o ng-reflect-name do <input> no site
# ---------------------------------------------------------------------------
FIELD_MAP = {
    "labelFirstName":   0,  # First Name
    "labelLastName":    1,  # Last Name
    "labelCompanyName": 2,  # Company Name
    "labelRole":        3,  # Role in Company
    "labelAddress":     4,  # Address
    "labelEmail":       5,  # Email
    "labelPhone":       6,  # Phone Number
}


def main():
    client = PerseusClient.from_env()
    client.start_task()
    client.log("=== RPA Challenge Bot iniciado ===")

    params = client.get_params()
    headless = str(params.get("headless", "true")).lower() != "false"
    client.log(f"Modo headless: {headless}")

    # ------------------------------------------------------------------
    # 1. Garantir Playwright instalado
    # ------------------------------------------------------------------
    client.log("Verificando instalação do Playwright / Chromium...")
    ensure_playwright_browsers()
    client.log("Playwright pronto.")

    # ------------------------------------------------------------------
    # 2. Baixar planilha
    # ------------------------------------------------------------------
    xlsx_url = "https://rpachallenge.com/assets/downloadFiles/challenge.xlsx"
    client.log(f"Baixando planilha: {xlsx_url}")
    resp = requests.get(xlsx_url, timeout=30)
    resp.raise_for_status()
    xlsx_path = "challenge.xlsx"
    with open(xlsx_path, "wb") as f:
        f.write(resp.content)
    client.log(f"Planilha salva ({len(resp.content) / 1024:.1f} KB)")

    # ------------------------------------------------------------------
    # 3. Ler dados da planilha
    # ------------------------------------------------------------------
    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb.active
    rows = [row for row in ws.iter_rows(min_row=2, values_only=True) if any(c for c in row)]
    total = len(rows)
    client.log(f"{total} registros encontrados na planilha")

    # ------------------------------------------------------------------
    # 4. Abrir browser e executar o desafio
    # ------------------------------------------------------------------
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    processed = 0
    failed = 0
    result_text = ""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        client.log("Abrindo rpachallenge.com...")
        page.goto("https://rpachallenge.com", timeout=30_000)
        page.wait_for_load_state("networkidle")

        # Clica em Start
        page.click("button:has-text('Start')")
        client.log("Desafio iniciado — preenchendo formulário...")

        for i, row in enumerate(rows, 1):
            try:
                # Aguarda o formulário estar visível
                page.wait_for_selector("form", timeout=10_000)

                for field_name, col_idx in FIELD_MAP.items():
                    value = str(row[col_idx] or "") if col_idx < len(row) else ""
                    selector = f"input[ng-reflect-name='{field_name}']"
                    page.fill(selector, value)

                page.click("input[type='submit']")
                processed += 1
                client.log(
                    f"[{i}/{total}] {row[0]} {row[1]} — OK",
                    level="info",
                )
            except PWTimeout as e:
                failed += 1
                client.error(e, context={"linha": i, "dados": row})
                client.log(f"[{i}/{total}] Timeout ao preencher linha — pulando", level="error")
            except Exception as e:
                failed += 1
                client.error(e, context={"linha": i, "dados": row})
                client.log(f"[{i}/{total}] Erro: {e}", level="error")

        # ------------------------------------------------------------------
        # 5. Capturar resultado e screenshot
        # ------------------------------------------------------------------
        try:
            page.wait_for_selector(".congratulations", timeout=5_000)
            result_text = page.inner_text(".congratulations").strip()
            client.log(f"Resultado final: {result_text}")
        except PWTimeout:
            result_text = f"{processed}/{total} submetidos"
            client.log("Não foi possível ler o resultado final da página")

        screenshot_path = "resultado.png"
        page.screenshot(path=screenshot_path, full_page=True)
        client.log("Screenshot salvo como resultado.png")
        browser.close()

    # ------------------------------------------------------------------
    # 6. Enviar artefatos
    # ------------------------------------------------------------------
    client.post_artifact(screenshot_path)
    client.post_artifact(xlsx_path)

    status = "SUCCESS" if failed == 0 else "FAILED"
    client.log(f"Concluído — {processed} OK, {failed} falhas")
    client.finish_task(
        status=status,
        total_items=total,
        processed=processed,
        failed=failed,
        message=result_text or f"{processed}/{total} registros submetidos",
    )
    print("Bot finalizado.")


if __name__ == "__main__":
    main()
