"""Prueba real del dictado IA: audio TTS en español -> transcripción -> borrador."""

import base64
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
WAV = Path(__file__).parent / "dictado_test.wav"

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
    page.click("text=Nueva entrada")
    page.wait_for_selector("text=Dictar con IA", timeout=10000)

    template_id = page.locator("input[name=template_id]").input_value()
    print("template_id:", template_id)

    audio_b64 = base64.b64encode(WAV.read_bytes()).decode()
    result = page.evaluate(
        """async ({ b64, templateId }) => {
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const form = new FormData();
            form.append('audio', new File([bytes], 'dictado.wav', { type: 'audio/wav' }));
            form.append('template_id', templateId);
            const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
            return { status: res.status, body: await res.json() };
        }""",
        {"b64": audio_b64, "templateId": template_id},
    )

    print("status:", result["status"])
    print(json.dumps(result["body"], indent=2, ensure_ascii=False))
    assert result["status"] == 200, "endpoint falló"
    assert result["body"]["draft"]["fields"], "borrador sin campos"

    browser.close()
    print("\nAI REAL TEST OK")
