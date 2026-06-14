import sys
from playwright.sync_api import sync_playwright

EMAIL = sys.argv[1]
PASSWORD = "Prueba1234!"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Landing
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    assert "AgendaPro" in page.content(), "Landing sin marca"
    print("OK landing")

    # Registro
    page.goto("http://localhost:3000/registro")
    page.wait_for_load_state("networkidle")
    page.fill("#full_name", "Dra. Prueba E2E")
    page.fill("#email", EMAIL)
    page.fill("#password", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: "/onboarding" in u or "/login" in u, timeout=20000)
    print("URL tras registro:", page.url)

    page.screenshot(path="e2e/out_step1.png", full_page=True)
    browser.close()
