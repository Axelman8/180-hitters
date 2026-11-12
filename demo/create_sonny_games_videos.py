"""Create four Dutch narrated videos from screenshots of the real game UI."""
from __future__ import annotations

import asyncio
import subprocess
import tempfile
import textwrap
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo"
SHOTS = ROOT / "tests"
VOICE = "nl-NL-MaartenNeural"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SIZE = (1280, 720)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)


def make_slide(title: str, body: str, screenshot: Path) -> Image.Image:
    canvas = Image.new("RGB", SIZE, "#08151c")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((20, 18, 1260, 702), radius=24, outline="#2a3b44", width=2)
    draw.text((55, 46), title, fill="#c8f56a", font=font(42, True))
    wrapped = "\n".join(textwrap.wrap(body, width=34))
    draw.multiline_text((58, 145), wrapped, fill="#d6e2e7", font=font(25), spacing=12)
    image = Image.open(screenshot).convert("RGB")
    image.thumbnail((700, 560), Image.Resampling.LANCZOS)
    canvas.paste(image, (1210 - image.width, 105 + (540 - image.height) // 2))
    draw.text((55, 650), "180 Hitters", fill="#ffffff", font=font(21, True))
    return canvas


async def speak(text: str, path: Path) -> None:
    await edge_tts.Communicate(text, VOICE, rate="-4%").save(str(path))


def run(command: list[str]) -> None:
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def video(game: str, screenshot: str, slides: list[tuple[str, str, str]]) -> Path:
    destination = OUT / f"180-Hitters-{game}-uitleg.mp4"
    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary)
        segments: list[Path] = []
        for index, (title, body, narration) in enumerate(slides, 1):
            picture = work / f"slide-{index}.png"
            audio = work / f"voice-{index}.mp3"
            segment = work / f"segment-{index}.mp4"
            make_slide(title, body, SHOTS / screenshot).save(picture)
            asyncio.run(speak(narration, audio))
            run([FFMPEG, "-y", "-loop", "1", "-i", str(picture), "-i", str(audio), "-c:v", "libx264", "-tune", "stillimage", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-pix_fmt", "yuv420p", "-shortest", str(segment)])
            segments.append(segment)
        listing = work / "segments.txt"
        listing.write_text("\n".join(f"file '{item.as_posix()}'" for item in segments), encoding="utf-8")
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(destination)])
    return destination


def main() -> None:
    OUT.mkdir(exist_ok=True)
    games = {
        "Scram": ("sonny-scram.png", [
            ("Scram", "Iedere speler krijgt een scoringsfase. De andere spelers zijn om beurten stopper.", "Bij Scram krijgt iedere speler een eigen scoringsfase. De andere spelers gooien om beurten als stopper."),
            ("Stop of scoor", "Een stopper sluit geraakte doelen. De scoorder krijgt alleen punten op doelen die nog open zijn.", "De stopper sluit elk geraakt doel van één tot en met twintig of bull. De scoorder krijgt daarna alleen punten voor doelen die nog open staan."),
            ("Hoogste score wint", "Na 21 gesloten doelen wisselt de scoringsfase. Na alle fases wint de hoogste totaalscore.", "Wanneer alle eenentwintig doelen gesloten zijn, gaat de scoringsfase naar de volgende speler. Na alle fases wint de hoogste totaalscore."),
        ]),
        "Killer": ("sonny-killer.png", [
            ("Killer", "Kies eerst met de verkeerde hand een uniek eigen getal.", "Bij Killer gooit iedere speler eerst één pijl met de verkeerde hand. Het geraakte unieke getal wordt zijn eigen nummer."),
            ("Bouw KILLER op", "Iedere treffer op je eigen getal levert één letter op. Zes letters maken je Killer.", "Raak tijdens je beurt je eigen getal. Iedere raak pijl levert één letter op. Met zes letters heb je het woord Killer compleet."),
            ("Schakel tegenstanders uit", "Als Killer verwijder je levens door het nummer van een tegenstander te raken. De laatste speler wint.", "Een actieve Killer raakt het nummer van een tegenstander om eerst letters en daarna het laatste leven te verwijderen. De laatste overgebleven speler wint."),
        ]),
        "Bull-41": ("sonny-bull41.png", [
            ("Bull en 41", "Iedere speler krijgt een puntenfase. De anderen verzamelen om beurten 25 bullmarks.", "Bij Bull en eenenveertig krijgt iedere speler een eigen puntenfase. De andere spelers proberen om beurten vijfentwintig bullmarks te verzamelen."),
            ("Bullmarks", "Single bull telt 1 mark. Dubbele bull telt 2 marks.", "Een single bull telt voor één mark en een dubbele bull voor twee. Zolang de vijfentwintig niet bereikt is, blijft de puntenfase actief."),
            ("Alleen boven 41", "De puntengooier scoort per beurt alleen het deel boven 41. Na alle fases wint de hoogste score.", "De puntengooier telt per beurt alleen de punten boven eenenveertig. Een worp van tweeënvijftig levert dus elf punten op. Na alle fases wint de hoogste score."),
        ]),
        "21": ("sonny-21.png", [
            ("21", "Werk in volgorde van 1 tot en met 20 en sluit af met Bull.", "Bij eenentwintig werk je in vaste volgorde van één tot en met twintig. Daarna sluit je af met bull."),
            ("Single, dubbel, triple", "Single gaat 1 doel verder, dubbel 2 en triple 3. Iedere beurt heeft maximaal drie pijlen.", "Raak het huidige doel. Een single gaat één plaats verder, een dubbel twee en een triple drie. Per beurt gebruik je maximaal drie pijlen."),
            ("Snelste speler wint", "De speler met de minste aangepaste pijlen wint. Bij gelijkstand geven de meeste triples de doorslag.", "Wie bull bereikt met de minste aangepaste pijlen wint. Bij een gelijke stand geven de meeste triples de doorslag."),
        ]),
    }
    for name, (shot, slides) in games.items():
        print(video(name, shot, slides))


if __name__ == "__main__":
    main()
