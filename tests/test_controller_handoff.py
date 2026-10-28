"""A dedicated tablet must not steal control back after a phone takeover."""
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    process = subprocess.Popen(
        [sys.executable, str(root / 'server.py'), '--host', '127.0.0.1', '--port', '8799',
         '--data-file', str(Path(tmp) / 'match.json')],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(.8)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            tablet = browser.new_page(viewport={'width': 600, 'height': 1024}, has_touch=True)
            tablet.add_init_script("""
                window.DartsAndroid={isTabletShell:true,isLocalMode:()=>false,
                  getConnectionMode:()=>'bluetooth',getControlToken:()=>'token',
                  getPendingNucTransfer:()=>'',getMobilePlayers:()=>'[]',hasMobilePlayers:()=>true,
                  getVenuePlayers:()=>'[]',saveMobilePlayers:()=>{},saveVenuePlayers:()=>{},
                  getConnectionInfo:()=>JSON.stringify({mode:'bluetooth',bluetoothConnected:true}),
                  saveSnapshot:()=>{},checkForUpdate:()=>{},chooseMode:()=>{}};
            """)
            tablet.goto('http://127.0.0.1:8799/?remote=1&android=1&transport=bluetooth')
            expect(tablet.locator('#controller-note')).to_have_text('Scorebediening actief')

            phone = browser.new_page(viewport={'width': 393, 'height': 852}, has_touch=True)
            phone.goto('http://127.0.0.1:8799/?remote=1')
            expect(phone.locator('#controller-note')).to_contain_text('Meekijken')
            phone.get_by_text('Verbindingen', exact=True).click()
            phone.locator('#take-control').click()
            expect(phone.locator('#controller-note')).to_have_text('Scorebediening actief')
            expect(tablet.locator('#controller-note')).to_contain_text('Meekijken')

            # The old tablet logic reclaimed ownership every five seconds.
            phone.wait_for_timeout(6500)
            expect(phone.locator('#controller-note')).to_have_text('Scorebediening actief')
            expect(tablet.locator('#controller-note')).to_contain_text('Meekijken')
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=5)

print('PASS: phone takeover remains active while the dedicated tablet watches')
