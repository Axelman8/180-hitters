"""Create a shareable 4-in-a-row MP4 from the real 180 Hitters UI."""
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
BG = "#08151c"
WHITE = "#f7fafc"
MUTED = "#a7bac5"
ACCENT = "#baff45"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def contain(image: Image.Image, box: tuple[int, int, int, int]) -> tuple[Image.Image, tuple[int, int]]:
    x, y, width, height = box
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy, (x + (width - copy.width) // 2, y + (height - copy.height) // 2)


def slide(title: str, body: str, assets: list[tuple[Path, tuple[int, int, int, int]]]) -> Image.Image:
    canvas = Image.new("RGB", SIZE, BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((54, 34), title, fill=ACCENT, font=font(42, True))
    lines = textwrap.wrap(body, width=72)
    draw.multiline_text((58, 92), "\n".join(lines), fill=MUTED, font=font(22), spacing=8)
    for path, box in assets:
        image = Image.open(path).convert("RGB")
        fitted, position = contain(image, box)
        canvas.paste(fitted, position)
    draw.rounded_rectangle((22, 18, 1258, 702), radius=24, outline="#263b47", width=2)
    draw.text((1055, 670), "180 Hitters", fill=WHITE, font=font(19, True))
    return canvas


def post_state(page, state: dict) -> None:
    current = page.request.get("http://127.0.0.1:8804/api/state").json()
    response = page.request.post(
        "http://127.0.0.1:8804/api/state",
        data={"revision": current["revision"], "match": {"state": state, "undo": []}},
    )
    assert response.ok


def capture_ui(work: Path) -> dict[str, Path]:
    data_file = work / "match.json"
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), "--host", "127.0.0.1", "--port", "8804", "--data-file", str(data_file)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    paths = {name: work / f"{name}.png" for name in ("board", "legend", "phone_board", "controls", "owned", "win", "bot")}
    try:
        time.sleep(1)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            screen = browser.new_page(viewport={"width": 1280, "height": 720})
            phone = browser.new_page(viewport={"width": 393, "height": 852}, is_mobile=True, has_touch=True)
            phone.goto("http://127.0.0.1:8804/?remote=1")
            state = phone.evaluate(
                """async()=>{const {newMatch}=await import('/engine.js');
                const s=newMatch(['Anna','Bert'],0,'single',1,{game:'fourinarow'});
                s.fourBoard=['sb1','n20','n5','n12','sb2','n1','n18','n9','n14','n7','n16','n3','bb','n11','n19','n8','n17','n4','n15','n2','sb3','n13','n6','n10','sb4'];return s;}"""
            )
            post_state(phone, state)
            screen.goto("http://127.0.0.1:8804/")
            expect(screen.locator(".four-board")).to_be_visible()
            screen.locator(".four-board").screenshot(path=str(paths["board"]))
            screen.locator(".four-legend").screenshot(path=str(paths["legend"]))
            phone.reload()
            expect(phone.locator(".four-board")).to_be_visible()
            phone.locator(".four-board").screenshot(path=str(paths["phone_board"]))
            phone.locator(".four-controls").screenshot(path=str(paths["controls"]))

            owned = json.loads(json.dumps(state))
            for index in (1, 6, 11):
                owned["fourOwners"][index] = 0
                owned["players"][0]["fourMarks"][index] = 3
            for index in (3, 8, 13):
                owned["fourOwners"][index] = 1
                owned["players"][1]["fourMarks"][index] = 3
            owned["players"][0]["fourMarks"][17] = 2
            owned["players"][1]["fourMarks"][18] = 1
            owned["active"] = 1
            post_state(phone, owned)
            screen.reload()
            expect(screen.locator(".four-board")).to_be_visible()
            screen.locator(".four-board").screenshot(path=str(paths["owned"]))

            bot = phone.evaluate("""async()=>{const {newMatch}=await import('/engine.js');return newMatch(['Jij'],0,'single',1,{game:'fourinarow',fourBot:true})}""")
            post_state(phone, bot)
            screen.reload()
            expect(screen.locator(".four-board")).to_be_visible()
            screen.locator("#fourinarow-root").screenshot(path=str(paths["bot"]))

            won = json.loads(json.dumps(owned))
            for index in (1, 6, 11, 16):
                won["fourOwners"][index] = 0
                won["players"][0]["fourMarks"][index] = 3
            # Keep the demo page interactive while displaying the real winning-cell styling.
            won.update({"phase": "playing", "winner": None, "reason": "four-in-row", "fourWinningCells": [1, 6, 11, 16]})
            post_state(phone, won)
            screen.reload()
            expect(screen.locator(".four-board")).to_be_visible()
            screen.wait_for_timeout(250)
            screen.locator(".four-board").screenshot(path=str(paths["win"]))
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    return paths


async def speak(text: str, path: Path) -> None:
    await edge_tts.Communicate(text, VOICE, rate="-4%").save(str(path))


def run(command: list[str]) -> None:
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def create_video(slides: list[tuple[Image.Image, str]], destination: Path, work: Path) -> None:
    segments = []
    for index, (picture, narration) in enumerate(slides, 1):
        image_path = work / f"slide-{index}.png"
        audio_path = work / f"voice-{index}.mp3"
        segment_path = work / f"segment-{index}.mp4"
        picture.save(image_path, quality=95)
        asyncio.run(speak(narration, audio_path))
        run([
            FFMPEG, "-y", "-loop", "1", "-i", str(image_path), "-i", str(audio_path),
            "-c:v", "libx264", "-tune", "stillimage", "-r", "30", "-c:a", "aac",
            "-b:a", "160k", "-pix_fmt", "yuv420p", "-shortest", str(segment_path),
        ])
        segments.append(segment_path)
    concat = work / "segments.txt"
    concat.write_text("\n".join(f"file '{path.as_posix()}'" for path in segments), encoding="utf-8")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(destination)])


def main() -> None:
    OUT.mkdir(exist_ok=True)
    destination = OUT / "180-Hitters-4-op-een-rij-uitleg.mp4"
    example = OUT / "4-op-een-rij-voorbeeld-2-spelers.png"
    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary)
        assets = capture_ui(work)
        slides = [
            (slide("Nieuw: 4 op een rij", "Een dartspel voor twee tot vier spelers, volledig in 180 Hitters.", [(assets["board"], (565, 135, 650, 520)), (assets["legend"], (60, 215, 440, 220))]),
             "Welkom bij vier op een rij in 180 Hitters. Je speelt met twee tot vier spelers. Iedere speler heeft een eigen, duidelijk herkenbaar symbool."),
            (slide("Een nieuw bord bij ieder spel", "Twintig getallen, vier keer single bull en de bull in het midden.", [(assets["board"], (415, 145, 700, 525))]),
             "Het speelveld bestaat uit vijf bij vijf vakken. De twintig getallen worden bij ieder nieuw spel opnieuw verdeeld, zonder dat een getal op dezelfde plaats blijft staan. In de hoeken staat single bull en in het midden de bull."),
            (slide("Drie marks verovert een vak", "Single is 1 mark · dubbel is 2 marks · triple is 3 marks.", [(assets["owned"], (415, 145, 700, 525))]),
             "Raak je een single, dan krijg je één mark. Een dubbel telt voor twee en een triple voor drie. Zodra je drie marks hebt, is het vak van jou en blijft het van jou."),
            (slide("Mobiel bedient, NUC toont", "Tik op het geraakte vak en kies single, dubbel of triple.", [(assets["phone_board"], (80, 170, 500, 480)), (assets["controls"], (690, 170, 470, 480))]),
             "Op de telefoon of tablet tik je het geraakte vak aan. Kies vooraf single, dubbel of triple. Na drie pijlen wordt de beurt automatisch naar de NUC gestuurd en gaat de volgende speler verder."),
            (slide("Vier op een rij wint", "Horizontaal, verticaal of diagonaal: vier eigen vakken is winst.", [(assets["win"], (415, 145, 700, 525))]),
             "Je wint zodra vier eigen vakken horizontaal, verticaal of diagonaal met elkaar zijn verbonden. De winnende rij licht direct op het grote scherm op."),
            (slide("Ook tegen de BOT", "Speel één tegen één tegen een BOT van ongeveer 50 gemiddeld.", [(assets["bot"], (345, 155, 800, 500))]),
             "Wil je alleen oefenen? Kies dan de BOT. Die speelt één tegen één op een niveau van ongeveer vijftig gemiddeld. Zo kun je vier op een rij ook zonder andere speler testen. Veel plezier met 180 Hitters."),
        ]
        slides[2][0].save(example, quality=95)
        create_video(slides, destination, work)
    print(destination)
    print(example)


if __name__ == "__main__":
    main()
