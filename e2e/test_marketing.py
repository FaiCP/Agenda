"""Prueba del generador de contenido para redes (premium genera, free ve upsell)."""

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

    # Premium: generar 3 posts de Instagram con promo
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "e2e.owner@agendapro.local")
    page.goto(f"{BASE}/app/marketing")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Contenido para redes", timeout=10000)
    page.locator("select").nth(1).select_option(value="promocion")
    page.fill(
        "#topic", "20% de descuento en consulta general durante todo junio"
    )
    page.click("text=Generar 3 publicaciones")
    page.wait_for_selector("text=Opción 3", timeout=90000)
    caption = page.locator("p.whitespace-pre-wrap").first.inner_text()
    assert len(caption) > 40, f"caption corta: {caption}"
    print("1. Premium: 3 publicaciones generadas. Opción 1:")
    print("---")
    print(caption[:400])
    print("---")
    badges = page.locator("text=/^#/").count()
    print(f"   hashtags visibles: {badges}")
    page.screenshot(path="e2e/out_marketing.png", full_page=True)
    ctx.close()

    # Free: upsell
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "e2e.onboarding@agendapro.local")
    page.goto(f"{BASE}/app/marketing")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Ver planes", timeout=10000)
    print("2. Free: pantalla de upsell con 'Ver planes'")
    ctx.close()

    browser.close()
    print("\nMARKETING TEST OK")
