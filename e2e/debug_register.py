import sys
from playwright.sync_api import sync_playwright

EMAIL = sys.argv[1]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))

    page.goto("http://localhost:3000/registro")
    page.wait_for_load_state("networkidle")
    page.fill("#full_name", "Dra. Prueba E2E")
    page.fill("#email", EMAIL)
    page.fill("#password", "Prueba1234!")
    page.click("button[type=submit]")
    page.wait_for_timeout(8000)

    print("URL:", page.url)
    err = page.locator("p.text-destructive")
    if err.count():
        print("ERROR UI:", err.first.inner_text())
    page.screenshot(path="e2e/out_debug.png", full_page=True)
    for l in logs[-10:]:
        print("CONSOLE:", l)
    browser.close()
