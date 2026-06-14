import datetime
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    page.on("response", lambda r: "rpc" in r.url and logs.append(f"RPC {r.status} {r.url}"))

    page.goto("http://localhost:3000/reservar/consultorio-e2e")
    page.wait_for_load_state("networkidle")
    page.locator("button:has-text('Consulta general')").first.click()
    page.wait_for_timeout(1000)

    d = datetime.date.today() + datetime.timedelta(days=1)
    while d.weekday() >= 5:
        d += datetime.timedelta(days=1)
    page.fill("#booking-date", d.isoformat())
    page.wait_for_timeout(4000)

    page.screenshot(path="e2e/out_booking_debug.png", full_page=True)
    for l in logs:
        print(l)
    print("BOTONES:", [b.inner_text() for b in page.locator("button").all()])
    browser.close()
