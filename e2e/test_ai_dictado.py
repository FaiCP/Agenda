"""Prueba del dictado IA: visibilidad por plan y gating del endpoint."""

import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
PASSWORD = "Prueba1234!"


def login(page, email):
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_url(re.compile("/(onboarding|app)"), timeout=30000)


def api_status(page):
    """POST sin audio al endpoint; devuelve (status, error)."""
    return page.evaluate(
        """async () => {
            const form = new FormData();
            const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
            const json = await res.json().catch(() => ({}));
            return { status: res.status, error: json.error ?? null };
        }"""
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # --- Org PREMIUM (Consultorio E2E): botón visible, endpoint pasa el gate ---
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "e2e.owner@agendapro.local")
    page.goto(f"{BASE}/app/clientes")
    page.wait_for_load_state("networkidle")
    page.locator("text=Ver expediente").first.click()
    page.wait_for_url(re.compile(r"/app/clientes/[0-9a-f-]+"), timeout=15000)
    page.click("text=Nueva entrada")
    page.wait_for_selector("text=Dictar con IA", timeout=10000)
    print("1. Premium: boton 'Dictar con IA' visible OK")

    r = api_status(page)
    assert r["status"] in (400, 503), f"esperaba 400/503, fue {r}"
    print(f"2. Premium: endpoint pasa gate de plan -> {r['status']} ({r['error']})")
    ctx.close()

    # --- Org FREE (Consultorio Onboarding Test): boton oculto, endpoint 403 ---
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "e2e.onboarding@agendapro.local")
    page.goto(f"{BASE}/app/clientes")
    page.wait_for_load_state("networkidle")

    r = api_status(page)
    assert r["status"] == 403, f"esperaba 403, fue {r}"
    print(f"3. Free: endpoint bloqueado -> 403 ({r['error']})")
    ctx.close()

    browser.close()
    print("\nAI DICTADO TEST OK")
