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
                () => [...document.querySelector('.team-editor').querySelectorAll('[data-member-name]')]
                    .forEach((input, index) => input.value = ['Een','Twee','Midden','Vier','Vijf'][index])
            """)
            page.locator(".wizard-team").first.locator(".wizard-team-slots button").nth(2).click()
            page.locator(".wizard-team").first.get_by_role("button", name="Geselecteerde naam weghalen").click()
            expect(page.locator(".wizard-team").first.locator(".wizard-team-slots button")).to_have_count(4)
            remaining = page.evaluate("""
                () => [...document.querySelector('.team-editor').querySelectorAll('[data-member-name]')].map(input => input.value)
            """)
            assert remaining == ['Een', 'Twee', 'Vier', 'Vijf'], remaining
            first_add.click()
            expect(page.locator(".wizard-team").first.locator(".wizard-team-slots button")).to_have_count(5)
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
            team_card_box = page.locator("#players .player").first.bounding_box()
            team_name_box = page.locator("#players .player").first.locator(".player-top > strong").bounding_box()
            assert abs((team_name_box["x"] + team_name_box["width"] / 2) -
                       (team_card_box["x"] + team_card_box["width"] / 2)) < 2
            expect(page.locator("#players .player").first.locator(".team-members span")).to_have_text(["Anita", "Bert", "Dylan", "Judith", "Leen"])
            expect(page.locator("#players .player").first.locator(".team-members .current")).to_have_text("Anita")
            assert page.locator("#players .team-members [data-turn-order]").count() == 0
            current_marker = page.locator("#players .player").first.locator(".team-members .current").evaluate(
                "element => getComputedStyle(element, '::before').content"
            )
            assert current_marker in ("none", '""'), current_marker
            member_size = page.locator("#players .player").first.locator(".team-members span").first.evaluate(
                "element => parseFloat(getComputedStyle(element).fontSize)"
            )
            assert member_size >= 32, f"NUC team member text is too small: {member_size}px"
            state = page.request.get("http://127.0.0.1:8791/api/state").json()["match"]["state"]
            assert state["teamMode"] is True
            assert state["players"][0]["members"] == ["Anita", "Bert", "Dylan", "Judith", "Leen"]
            enter_total(page, "60")
            page.locator("#submit:visible, #confirm-total:visible").click()
            expect(page.locator("#players .player").nth(1).locator(".team-members .current")).to_have_text("Ed")
            enter_total(page, "45")
            page.locator("#submit:visible, #confirm-total:visible").click()
            expect(page.locator("#players .player").first.locator(".team-members .current")).to_have_text("Bert")
            # De spelersvolgorde loopt door over een legwissel en start niet
            # onterecht opnieuw bij de eerste naam.
            current_payload = page.request.get("http://127.0.0.1:8791/api/state").json()
            current_payload["match"]["state"]["leg"] = 2
            saved = page.request.post(
                "http://127.0.0.1:8791/api/state",
                data={"revision": current_payload["revision"], "match": current_payload["match"]},
            )
            assert saved.ok
            page.wait_for_timeout(1200)
            expect(page.locator("#players .player").first.locator(".team-members .current")).to_have_text("Bert")

            # Teambeheer is tijdens de partij beschikbaar op de NUC.
            page.locator("#team-manager").evaluate("element => element.click()")
            expect(page.locator("#team-manager-dialog")).to_be_visible()
            first_team = page.locator(".team-manager-team").first
            first_team.locator(".team-manager-row").first.get_by_role("button", name="Omlaag").click()
            reordered = first_team.locator("input").evaluate_all("elements => elements.map(element => element.value)")
            assert reordered == ["Bert", "Anita", "Dylan", "Judith", "Leen"], reordered
            first_team.locator("input").nth(1).fill("Invaller")
            page.locator("#team-manager-save").click()
            expect(page.locator("#team-manager-dialog")).to_be_hidden()
            expect(page.locator("#players .player").first.locator(".team-members span")).to_have_text(
                ["Bert", "Invaller", "Dylan", "Judith", "Leen"]
            )
            expect(page.locator("#players .player").first.locator(".team-members .current")).to_have_text("Invaller")

            # Partij aanpassen opent hetzelfde volledige instellingenscherm.
            page.locator("#edit-match").evaluate("element => element.click()")
            expect(page.locator("#setup")).to_be_visible()
            expect(page.locator(".wizard-back")).to_be_visible()
            page.locator(".wizard-back").click()
            mobile = browser.new_page(viewport={"width": 393, "height": 852})
            mobile.goto("http://127.0.0.1:8791/?remote=1")
            expect(mobile.locator("#players .player").first.locator(".team-members span")).to_have_text(["Bert", "Invaller", "Dylan", "Judith", "Leen"])
            expect(mobile.locator("#team-manager")).to_have_count(1)
            expect(mobile.locator("#edit-match")).to_have_count(1)
            mobile_member_size = mobile.locator("#players .player").first.locator(".team-members span").first.evaluate(
                "element => parseFloat(getComputedStyle(element).fontSize)"
            )
            assert mobile_member_size >= 15, f"Mobile team member text is too small: {mobile_member_size}px"
            android_phone = browser.new_page(viewport={"width": 393, "height": 852})
            android_phone.add_init_script("""
                window.DartsAndroid = {
                    isTabletShell: false,
                    isLocalMode: () => true,
                    getMobilePlayers: () => '[]',
                    saveMobilePlayers: () => {},
                    getVenuePlayers: () => '[]',
                    saveVenuePlayers: () => {},
                    hasMobilePlayers: () => true
                };
            """)
            android_phone.goto("http://127.0.0.1:8791/")
            expect(android_phone.locator("#players-form .player-destination-actions button").nth(1)).to_have_text("Toevoegen aan mobiel")
            print("PASS: tijdelijke teams, maximaal vijf namen, scorekaarten en spelersrotatie")
            browser.close()
    finally:
        server.terminate()
        server.wait()
