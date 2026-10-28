from pathlib import Path
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen(
        [sys.executable, str(root / "server.py"), "--host", "127.0.0.1", "--port", "8796",
         "--data-file", str(Path(tmp) / "match.json")],
        cwd=root,
    )
    try:
        time.sleep(.8)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1080, "height": 1920})
            page.route("**/api/network/control", lambda route: route.fulfill(
                status=200, content_type="application/json",
                body='{"available":true,"busy":false,"hotspot":"00000000-0000-0000-0000-000000000001","profiles":[],"operation":{}}',
            ))
            page.goto("http://127.0.0.1:8796/")

            expect(page.locator("#fullscreen")).to_be_hidden()
            expect(page.locator("#kiosk-mode-toggle")).to_have_text("Kioskmodus verlaten")

            page.locator("#bluetooth-open").evaluate("element => element.click()")
            expect(page.locator("#bluetooth-dialog")).to_be_visible()
            expect(page.locator("#nuc-controls")).to_be_visible()
            for label in ("Wifi aan", "Wifi uit", "Bluetooth aan", "Bluetooth uit"):
                expect(page.get_by_role("button", name=label, exact=True)).to_be_visible()
            page.locator("#bluetooth-close").click()

            page.locator("#venue-open").evaluate("element => element.click()")
            expect(page.get_by_role("button", name="Wifi en Bluetooth beheren")).to_be_visible()
            page.get_by_role("button", name="Wifi en Bluetooth beheren").click()
            expect(page.locator("#bluetooth-dialog")).to_be_visible()
            page.locator("#bluetooth-close").click()

            page.locator("#network-open").evaluate("element => element.click()")
            expect(page.locator("#network-add-section")).to_be_visible()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

print("PASS: lokale NUC heeft muisbediening voor kiosk, wifi en Bluetooth")
