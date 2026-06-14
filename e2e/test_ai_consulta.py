"""Prueba del modo consulta: conversación completa -> resumen estructurado."""

import base64
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
WAV = Path(__file__).parent / "consulta_test.wav"

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

    # UI: grabador visible en el expediente
    page.wait_for_selector("text=Grabar consulta", timeout=10000)
    print("1. Boton 'Grabar consulta' visible en expediente")

    template_id = "da6d65b4-da85-4bcd-a1c7-ff3f9a78b635"
    audio_b64 = base64.b64encode(WAV.read_bytes()).decode()
    result = page.evaluate(
        """async ({ b64, templateId }) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const form = new FormData();
            form.append('audio', new File([bytes], 'consulta.wav', { type: 'audio/wav' }));
            form.append('template_id', templateId);
            form.append('mode', 'consulta');
            const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
            return { status: res.status, body: await res.json() };
        }""",
        {"b64": audio_b64, "templateId": template_id},
    )

    print("2. status:", result["status"])
    print(json.dumps(result["body"]["draft"], indent=2, ensure_ascii=False))
    assert result["status"] == 200
    draft = result["body"]["draft"]
    assert draft["fields"], "sin campos"
    assert len(draft["notes"]) > 100, "notas muy cortas para una consulta"

    browser.close()
    print("\nAI CONSULTA TEST OK")
