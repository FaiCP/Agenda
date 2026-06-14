"""Prueba real: generar receta médica con IA y guardarla en el expediente."""

import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", "e2e.owner@agendapro.local")
    page.fill("#password", "Prueba1234!")
    page.click("button[type=submit]")
    page.wait_for_url(re.compile("/app"), timeout=30000)

    page.goto(f"{BASE}/app/clientes")
    page.wait_for_load_state("networkidle")
    page.locator("text=Ver expediente").first.click()
    page.wait_for_url(re.compile(r"/app/clientes/[0-9a-f-]+"), timeout=15000)

    page.click("text=Generar documento")
    page.wait_for_selector("text=Tipo de documento", timeout=10000)
    print("1. Dialogo abierto")

    page.select_option("select", value="receta")
    page.fill(
        "#doc-instructions",
        "paracetamol 500 mg cada 8 horas por 5 dias; reposo relativo 2 dias",
    )
    page.click("text=Generar borrador")
    page.wait_for_selector("#doc-body", timeout=60000)
    body = page.locator("#doc-body").input_value()
    assert "paracetamol" in body.lower(), f"receta sin medicamento: {body[:200]}"
    print("2. Borrador generado:")
    print("---")
    print(body[:600])
    print("---")

    page.click("text=Guardar en expediente")
    page.wait_for_selector("text=Documento: Receta médica", timeout=15000)
    print("3. Guardado en expediente OK")

    browser.close()
    print("\nAI DOCUMENTO TEST OK")
