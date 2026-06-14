"""Prueba aislada del flujo de onboarding (nuevo usuario sin organización)."""

import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
EMAIL = "e2e.onboarding@agendapro.local"
PASSWORD = "Prueba1234!"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", EMAIL)
    page.fill("#password", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_url(re.compile("/(onboarding|app)"), timeout=30000)
    print("1. Login OK ->", page.url)

    page.goto(f"{BASE}/onboarding")
    page.wait_for_load_state("networkidle")
    print("2. En onboarding:", page.url)

    page.click("text=Médico / Clínica")
    page.fill("#name", "Consultorio Onboarding Test")
    page.fill("#phone", "0991112233")
    page.click("button[type=submit]")

    try:
        page.wait_for_url(re.compile(r"/app$"), timeout=15000)
        print("3. Onboarding OK ->", page.url)
    except Exception:
        page.wait_for_load_state("networkidle")
        error = page.locator("text=No se pudo").count()
        print("3. FALLO. URL:", page.url, "| error visible:", error > 0)
        page.screenshot(path="e2e/out_onboarding_fail.png", full_page=True)
        raise

    browser.close()
    print("\nONBOARDING TEST OK")
