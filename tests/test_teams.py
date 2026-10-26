from pathlib import Path
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import expect, sync_playwright

from ui_input import enter_total


root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    server = subprocess.Popen(
        [sys.executable, str(root / "server.py"), "--host", "127.0.0.1", "--port", "8791", "--data-file", str(Path(tmp) / "match.json")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            # The shared web bundle is also the full-screen Linux NUC UI.
            page = browser.new_page(viewport={"width": 1080, "height": 1920})
            page.goto("http://127.0.0.1:8791/")
            page.get_by_role("button", name="X01 Van je startscore").click()
            page.get_by_role("button", name="Kies spelers").click()
            page.get_by_role("button", name="Teams", exact=True).click()
            expect(page.locator(".wizard-team")).to_have_count(2)
            first_add = page.locator(".wizard-team").first.get_by_role("button", name="Naam toevoegen")
            for _ in range(3):
                first_add.click()
            expect(page.locator(".wizard-team").first.locator(".wizard-team-slots button")).to_have_count(5)
            expect(first_add).to_be_disabled()
            page.evaluate("""
                () => {
                    const teams = [...document.querySelectorAll('#names .team-editor')];
                    const values = [['Rood', ['Anita','Bert','Dylan','Judith','Leen']], ['Blauw', ['Ed','Frank']]];
                    teams.forEach((team, index) => {
                        team.querySelector('input[data-team-name]').value = values[index][0];
                        [...team.querySelectorAll('[data-member-name]')].forEach((input, member) => input.value = values[index][1][member]);
                    });
                    document.querySelector('#setup-form').requestSubmit();
                }
            """)
            expect(page.locator("#players .player")).to_have_count(2)
            expect(page.locator("#players .player").first.locator("strong").first).to_have_text("Rood")
            expect(page.locator("#players .player").first.locator(".team-members span")).to_have_text(["Anita", "Bert", "Dylan", "Judith", "Leen"])
            expect(page.locator("#players .player").first.locator(".team-members .current")).to_have_text("Anita")
            member_size = page.locator("#players .player").first.locator(".team-members span").first.evaluate(
                "element => parseFloat(getComputedStyle(element).fontSize)"
            )
            assert member_size >= 64, f"NUC team member text is too small: {member_size}px"
            state = page.request.get("http://127.0.0.1:8791/api/state").json()["match"]["state"]
            assert state["teamMode"] is True
            assert state["players"][0]["members"] == ["Anita", "Bert", "Dylan", "Judith", "Leen"]
            enter_total(page, "60")
            page.locator("#submit:visible, #confirm-total:visible").click()
            expect(page.locator("#players .player").nth(1).locator(".team-members .current")).to_have_text("Ed")
            enter_total(page, "45")
            page.locator("#submit:visible, #confirm-total:visible").click()
            expect(page.locator("#players .player").first.locator(".team-members .current")).to_have_text("Bert")
            mobile = browser.new_page(viewport={"width": 393, "height": 852})
            mobile.goto("http://127.0.0.1:8791/?remote=1")
            expect(mobile.locator("#players .player").first.locator(".team-members span")).to_have_text(["Anita", "Bert", "Dylan", "Judith", "Leen"])
            mobile_member_size = mobile.locator("#players .player").first.locator(".team-members span").first.evaluate(
                "element => parseFloat(getComputedStyle(element).fontSize)"
            )
            assert mobile_member_size >= 30, f"Mobile team member text is too small: {mobile_member_size}px"
            print("PASS: tijdelijke teams, maximaal vijf namen, scorekaarten en spelersrotatie")
            browser.close()
    finally:
        server.terminate()
        server.wait()
