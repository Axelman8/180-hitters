"""Create the Dutch online-darts instruction video from the real 180 Hitters UI."""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import tempfile
import textwrap
import time
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo"
VOICE = "nl-NL-MaartenNeural"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SIZE = (1280, 720)
CENTRAL = "https://180-hitters-online.180-hitters-online.workers.dev"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)


def slide(title: str, body: str, screenshots: list[tuple[Path, tuple[int, int, int, int]]]) -> Image.Image:
    canvas = Image.new("RGB", SIZE, "#08151c")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((20, 18, 1260, 702), radius=24, outline="#2a3b44", width=2)
    draw.text((54, 38), title, fill="#c8f56a", font=font(40, True))
    draw.multiline_text((58, 102), "\n".join(textwrap.wrap(body, width=43)), fill="#d6e2e7", font=font(24), spacing=10)
    for path, (x, y, width, height) in screenshots:
        image = Image.open(path).convert("RGB")
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        canvas.paste(image, (x + (width - image.width) // 2, y + (height - image.height) // 2))
    draw.text((55, 658), "180 Hitters · Online darten", fill="#ffffff", font=font(20, True))
    return canvas


def post(page, path: str, value: dict) -> None:
    response = page.request.post(f"http://127.0.0.1:8806{path}", data=value)
    assert response.ok, response.text()


def capture(work: Path) -> dict[str, Path]:
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), "--host", "127.0.0.1", "--port", "8806", "--data-file", str(work / "match.json")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    shots = {name: work / f"{name}.png" for name in ("create", "invite", "join", "starter", "game")}
    try:
        time.sleep(1)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={"width": 430, "height": 900}, is_mobile=True, has_touch=True)
            room: dict = {}

            def cloud(route) -> None:
                url = route.request.url
                if url.endswith("/lobby"):
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({"rooms": [{"code": "DART28", "host": "Anna", "joined": 1, "capacity": 2}]}))
                    return
                if "/rooms/DART28" in url:
                    route.fulfill(status=200, content_type="application/json", body=json.dumps(room))
                    return
                route.fulfill(status=404, content_type="application/json", body=json.dumps({"error": "Niet gebruikt in video"}))

            page.route(f"{CENTRAL}/**", cloud)
            page.goto("http://127.0.0.1:8806/?remote=1")
            state = page.evaluate("""async()=>{const {newMatch}=await import('/engine.js');return newMatch(['Anna','Bert'],0,'single',1,{game:'fourinarow'});} """)
            current = page.request.get("http://127.0.0.1:8806/api/state").json()
            post(page, "/api/state", {"revision": current["revision"], "match": {"state": state, "undo": []}})

            page.locator("#online-host-open").evaluate("button=>button.click()")
            page.locator("#online-host-name").fill("Anna")
            page.locator("#online-capacity").select_option("2")
            page.locator("#online-dialog").screenshot(path=str(shots["create"]))
            page.locator("#online-close").click()

            room = {"code": "DART28", "revision": 2, "match": {"state": state, "undo": []}, "joined": 1, "capacity": 2,
                    "public": True, "starter": None, "starterPending": False, "draft": None}
            post(page, "/api/online/local", {"active": True, "ready": False, "role": 0, "code": "DART28", "base": CENTRAL,
                                             "key": "host-key-for-video-123456", "remoteRevision": 2})
            page.reload(); page.wait_for_timeout(300)
            page.locator("#online-host-open").evaluate("button=>button.click()")
            expect(page.locator("#online-share")).to_be_visible()
            page.locator("#online-dialog").screenshot(path=str(shots["invite"]))
            page.locator("#online-close").click()

            post(page, "/api/online/local", {"active": False, "ready": False, "role": None, "code": "", "base": "", "key": "", "remoteRevision": 0})
            page.reload(); page.wait_for_timeout(250)
            page.locator("#online-join-open").evaluate("button=>button.click()")
            page.locator("#online-guest-name").fill("Bert")
            expect(page.locator(".online-lobby-room")).to_be_visible()
            page.locator("#online-dialog").screenshot(path=str(shots["join"]))
            page.locator("#online-close").click()

            room = {"code": "DART28", "revision": 3, "match": {"state": state, "undo": []}, "joined": 2, "capacity": 2,
                    "public": True, "starter": None, "starterPending": True, "draft": None}
            post(page, "/api/online/local", {"active": True, "ready": False, "role": 0, "code": "DART28", "base": CENTRAL,
                                             "key": "host-key-for-video-123456", "remoteRevision": 3})
            page.reload()
            expect(page.locator("#online-starter-options button")).to_have_count(2)
            page.locator("#online-starter").screenshot(path=str(shots["starter"]))

            state["active"] = 0
            room = {**room, "revision": 4, "starter": 0, "starterPending": False, "match": {"state": state, "undo": []}}
            post(page, "/api/online/local", {"active": True, "ready": True, "role": 0, "code": "DART28", "base": CENTRAL,
                                             "key": "host-key-for-video-123456", "remoteRevision": 4})
            page.reload(); page.wait_for_timeout(1500)
            expect(page.locator(".four-board")).to_be_visible()
            page.locator("#fourinarow-root").screenshot(path=str(shots["game"]))
            browser.close()
    finally:
        server.terminate(); server.wait(timeout=10)
    return shots


async def speak(text: str, path: Path) -> None:
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, VOICE, rate="-4%").save(str(path)); return
        except edge_tts.exceptions.NoAudioReceived:
            path.unlink(missing_ok=True)
            if attempt == 3: raise
            await asyncio.sleep(3 * (attempt + 1))


def run(command: list[str]) -> None:
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    destination = OUT / "180-Hitters-Online-darten-uitleg.mp4"
    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary); shots = capture(work)
        slides = [
            (slide("1. Maak een dartbaan", "Open Online darten, vul je naam in en kies het aantal spelers.", [(shots["create"], (555, 105, 650, 535))]),
             "Open in het menu Online darten en kies Dartbaan aanmaken. Vul je naam in, kies twee, drie of vier spelers en bepaal of de dartbaan in de openbare lijst mag staan. Tik daarna op Dartbaan aanmaken."),
            (slide("2. Verstuur de uitnodiging", "Deel rechtstreeks via WhatsApp of kopieer de uitnodigingslink.", [(shots["invite"], (555, 105, 650, 535))]),
             "Zodra de dartbaan bestaat zie je de unieke code. Kies Uitnodiging delen om WhatsApp of een andere app te openen. Met Uitnodiging kopieren kun je de link ook zelf in een bericht plakken."),
            (slide("3. De andere speler neemt deel", "Vul een naam in en kies de vrije dartbaan, of open de ontvangen link.", [(shots["join"], (555, 105, 650, 535))]),
             "De andere speler opent Online darten en kiest Deelnemen aan online dartbaan. Na het invullen van de naam kan de speler jouw vrije dartbaan selecteren. Een ontvangen uitnodigingslink werkt ook."),
            (slide("4. Kies samen wie begint", "Zodra iedereen aanwezig is kiest een speler de startspeler.", [(shots["starter"], (555, 145, 650, 440))]),
             "Wanneer alle spelers aanwezig zijn, ziet iedereen dezelfde namen. Spreek af wie begint en tik die naam aan. De eerste keuze wordt vastgezet. Daarna opent bij iedereen automatisch het speelveld."),
            (slide("5. Speel realtime", "Iedere pijl verschijnt direct bij alle spelers. Na de beurt gaat de bediening automatisch verder.", [(shots["game"], (500, 100, 720, 545))]),
             "Tijdens vier op een rij wordt iedere ingevoerde pijl direct bij alle spelers getoond. Na de derde pijl, of meteen bij winst, wordt de beurt afgesloten en gaat de volgende speler automatisch verder. Veel plezier met online darten in 180 Hitters."),
        ]
        segments = []
        for index, (picture, narration) in enumerate(slides, 1):
            image = work / f"slide-{index}.png"; audio = work / f"voice-{index}.mp3"; segment = work / f"segment-{index}.mp4"
            picture.save(image); asyncio.run(speak(narration, audio))
            run([FFMPEG, "-y", "-loop", "1", "-i", str(image), "-i", str(audio), "-c:v", "libx264", "-tune", "stillimage",
                 "-r", "30", "-c:a", "aac", "-b:a", "160k", "-pix_fmt", "yuv420p", "-shortest", str(segment)])
            segments.append(segment)
        listing = work / "segments.txt"
        listing.write_text("\n".join(f"file '{item.as_posix()}'" for item in segments), encoding="utf-8")
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(destination)])
    print(destination)


if __name__ == "__main__":
    main()
