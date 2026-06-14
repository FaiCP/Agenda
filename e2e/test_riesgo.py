"""Prueba de la página de riesgo de abandono (premium ve análisis, free ve upsell)."""

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


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # Premium: lista de riesgo con los clientes sembrados
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "e2e.owner@agendapro.local")
    page.goto(f"{BASE}/app/riesgo")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Riesgo de abandono", timeout=10000)
    assert page.locator("text=Ana Abandono Test").count() > 0, "Ana no aparece"
    assert page.locator("text=Pedro NoShow Test").count() > 0, "Pedro no aparece"
    print("1. Premium: Ana y Pedro listados en riesgo")
    page.screenshot(path="e2e/out_riesgo.png", full_page=True)
    ctx.close()

    # Free: upsell
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "e2e.onboarding@agendapro.local")
    page.goto(f"{BASE}/app/riesgo")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Ver planes", timeout=10000)
    print("2. Free: pantalla de upsell con 'Ver planes'")
    ctx.close()

    browser.close()
    print("\nRIESGO TEST OK")
