"""Flujo e2e completo: login → onboarding → cliente → reserva pública →
agenda → expediente → pago → admin."""

import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
EMAIL = "e2e.owner@agendapro.local"
PASSWORD = "Prueba1234!"
OUT = Path("e2e")


def shot(page, name):
    page.screenshot(path=str(OUT / f"out_{name}.png"), full_page=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()

    # ---- 1. Login
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", EMAIL)
    page.fill("#password", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_url(re.compile("/(onboarding|app)"), timeout=30000)
    print("1. Login OK →", page.url)

    # ---- 2. Onboarding (la página redirige a /app si ya existe organización)
    page.goto(f"{BASE}/onboarding")
    page.wait_for_load_state("networkidle")
    if "/onboarding" in page.url:
        page.click("text=Médico / Clínica")
        page.fill("#name", "Consultorio E2E")
        page.fill("#phone", "0991112233")
        page.click("button[type=submit]")
        page.wait_for_url(re.compile(r"/app$"), timeout=30000)
        print("2. Onboarding OK →", page.url)
    else:
        print("2. Onboarding ya hecho")

    page.wait_for_load_state("networkidle")
    shot(page, "agenda")

    # ---- 3. Crear cliente
    page.goto(f"{BASE}/app/clientes")
    page.wait_for_load_state("networkidle")
    page.click("text=Nuevo paciente")
    page.fill("#full_name", "Juan Pérez Paciente")
    page.fill("#email", "luisangel88776+paciente@gmail.com")
    page.fill("#phone", "0998887766")
    page.click("dialog button[type=submit], [role=dialog] button[type=submit]")
    page.wait_for_url(re.compile("/app/clientes/[0-9a-f-]+"), timeout=30000)
    client_url = page.url
    print("3. Cliente creado →", client_url)

    # ---- 4. Entrada de expediente
    page.wait_for_load_state("networkidle")
    page.click("text=Nueva entrada")
    page.wait_for_selector("[role=dialog]")
    page.fill("[role=dialog] #title", "Primera consulta")
    page.fill("[role=dialog] [name=field__motivo_consulta]", "Dolor de cabeza recurrente")
    page.fill("[role=dialog] [name=field__diagnostico]", "Cefalea tensional")
    page.click("[role=dialog] button[type=submit]")
    page.wait_for_selector("text=Primera consulta", timeout=30000)
    print("4. Entrada de expediente OK")
    shot(page, "expediente")

    # ---- 5. Obtener slug de la página pública
    page.goto(f"{BASE}/app/configuracion")
    page.wait_for_load_state("networkidle")
    booking_url = page.locator("input[readonly]").first.input_value()
    print("5. URL pública:", booking_url)

    # ---- 6. Reserva pública (contexto incógnito = visitante anónimo)
    visitor = browser.new_context()
    vpage = visitor.new_page()
    vpage.goto(booking_url)
    vpage.wait_for_load_state("networkidle")
    shot_path = OUT / "out_booking.png"
    vpage.locator("button:has-text('Consulta general')").first.click()
    vpage.wait_for_selector("text=2. Elige profesional", timeout=15000)
    # fecha: mañana (los lunes-viernes tienen horario; si cae finde, avanzar)
    import datetime
    d = datetime.date.today() + datetime.timedelta(days=1)
    while d.weekday() >= 5:
        d += datetime.timedelta(days=1)
    # esperar la recarga de slots tras cambiar la fecha (evita clickear slots viejos)
    with vpage.expect_response(
        lambda r: "get_available_slots" in r.url, timeout=15000
    ):
        vpage.fill("#booking-date", d.isoformat())
    vpage.wait_for_timeout(500)
    slot_buttons = vpage.locator("button").filter(
        has_text=re.compile(r"^\d{2}:\d{2}$")
    )
    count = 0
    for _ in range(20):
        count = slot_buttons.count()
        if count > 0:
            break
        vpage.wait_for_timeout(1000)
    print(f"6. Slots visibles para {d}: {count}")
    assert count > 0, "Sin slots disponibles"
    slot_buttons.first.click()
    vpage.fill("#name", "María Visitante")
    vpage.fill("#email", "luisangel88776+visita@gmail.com")
    vpage.fill("#phone", "0991234567")
    vpage.click("button[type=submit]")
    vpage.wait_for_selector("text=¡Cita reservada!", timeout=30000)
    print("6. Reserva pública OK")
    vpage.screenshot(path=str(shot_path), full_page=True)
    visitor.close()

    # ---- 7. Verificar cita en la agenda del profesional
    page.goto(f"{BASE}/app?fecha={d.isoformat()}")
    page.wait_for_load_state("networkidle")
    assert page.locator("text=María Visitante").count() > 0, "Cita no visible en agenda"
    print("7. Cita visible en agenda OK")
    shot(page, "agenda_con_cita")

    # ---- 8. Pago por transferencia
    page.goto(f"{BASE}/app/facturacion")
    page.wait_for_load_state("networkidle")
    page.locator("button:has-text('Pagar por transferencia')").first.click()
    page.wait_for_selector("[role=dialog]")
    # comprobante: png mínimo
    png = OUT / "comprobante.png"
    png.write_bytes(
        bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000d49444154789c626001000000ffff03000006000557bfabd4000000"
            "0049454e44ae426082"
        )
    )
    page.set_input_files("#receipt", str(png))
    page.click("[role=dialog] button[type=submit]")
    page.wait_for_selector("text=En revisión", timeout=30000)
    print("8. Pago enviado OK")

    # ---- 9. Admin: aprobar pago
    page.goto(f"{BASE}/admin")
    page.wait_for_load_state("networkidle")
    page.locator("button:has-text('Aprobar')").first.click()
    page.wait_for_selector("text=No hay pagos pendientes", timeout=30000)
    print("9. Pago aprobado OK")
    shot(page, "admin")

    # ---- 10. Plan activo
    page.goto(f"{BASE}/app/facturacion")
    page.wait_for_load_state("networkidle")
    assert page.locator("text=Aprobado").count() > 0, "Pago no aprobado"
    print("10. Plan activado OK")
    shot(page, "facturacion")

    browser.close()
    print("\nFLUJO E2E COMPLETO ✔")
