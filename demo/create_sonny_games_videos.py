"""Create Dutch narrated videos from screenshots of the real game UI."""
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
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, VOICE, rate="-4%").save(str(path))
            return
        except edge_tts.exceptions.NoAudioReceived:
            path.unlink(missing_ok=True)
            if attempt == 3:
                raise
            await asyncio.sleep(3 * (attempt + 1))


def run(command: list[str]) -> None:
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def video(game: str, screenshot: str, slides: list[tuple[str, str, str]]) -> Path:
    destination = OUT / f"180-Hitters-{game}-uitleg.mp4"
    if destination.exists():
        return destination
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
        "X01": ("screen-fit-x01-False.png", [
            ("X01", "Kies een startscore en speel exact naar nul.", "Bij X nul één kies je een startscore, bijvoorbeeld driehonderdeen of vijfhonderdeen. Het doel is om exact op nul te eindigen."),
            ("Kies jouw regels", "Straight, dubbel of master in en uit. Kies ook legs, sets en de bullwaarde.", "Voor de partij kies je de beginregel, de uitgooiregel, de bullwaarde en of je met legs of sets speelt."),
            ("Voer iedere beurt in", "Gebruik de totaalscore of voer iedere pijl apart in. De app toont een mogelijke finish.", "Voer na iedere beurt de totaalscore in, of registreer de drie pijlen afzonderlijk. De app controleert busts en toont een mogelijke finishroute."),
        ]),
        "Cricket": ("screen-fit-cricket-False.png", [
            ("Cricket", "Sluit 15, 16, 17, 18, 19, 20 en Bull.", "Bij Cricket probeer je de doelen vijftien tot en met twintig en bull elk met drie marks te sluiten."),
            ("Marks en punten", "Single telt 1 mark, dubbel 2 en triple 3.", "Een single telt als één mark, een dubbel als twee en een triple als drie. Extra treffers kunnen punten opleveren zolang een tegenstander het doel nog open heeft."),
            ("Kies de puntentelling", "Speel Standard, Cut Throat of No Score.", "Je kunt Standard spelen voor de hoogste score, Cut Throat voor de laagste score, of No Score waarbij alleen het sluiten van alle doelen telt."),
        ]),
        "Tactics": ("screen-fit-tactics-False.png", [
            ("Tactics", "Sluit alle doelen van 10 tot en met 20 en Bull.", "Tactics werkt als een uitgebreide Cricketvariant. Je sluit de getallen tien tot en met twintig en daarna bull."),
            ("Drie marks per doel", "Single telt 1, dubbel 2 en triple 3 marks.", "Ieder doel heeft drie marks nodig. De invoer toont direct welke getallen open of gesloten zijn voor iedere speler."),
            ("Punten en winnaar", "Extra treffers scoren volgens de gekozen spelvariant.", "Op een gesloten doel kun je punten maken zolang een tegenstander dit nog open heeft. Wie alle doelen sluit en aan de scorevoorwaarde voldoet, wint."),
        ]),
        "121": ("screen-fit-121-False.png", [
            ("121", "Gooi jouw niveau uit binnen maximaal negen darts.", "Bij de training honderdeenentwintig probeer je jouw actuele niveau binnen maximaal negen darts uit te gooien met dubbel uit."),
            ("Drie beurten", "Je krijgt drie bezoeken van maximaal drie pijlen.", "Je hebt maximaal drie beurten van drie pijlen. Met meerdere spelers wisselt de beurt steeds na drie darts en behoudt iedereen zijn eigen poging."),
            ("Niveau stijgt of daalt", "Geslaagd: niveau omhoog. Niet geslaagd: niveau omlaag, minimaal 121.", "Gooi je uit, dan stijgt het volgende niveau met één plus het aantal overgebleven pijlen. Lukt het niet, dan daalt het niveau met één tot minimaal honderdeenentwintig."),
        ]),
        "Gotcha": ("screen-fit-gotcha-False.png", [
            ("Gotcha", "Bouw jouw score op tot precies de gekozen doelscore.", "Bij Gotcha begint iedere speler op nul. Tel je worpen op en bereik precies de gekozen doelscore."),
            ("Zet een tegenstander op nul", "Kom exact gelijk met een tegenstander en die verliest zijn score.", "Bereik je precies de actuele score van een tegenstander, dan wordt die speler teruggezet naar nul. Dat is de Gotcha."),
            ("Voorkom een bust", "Te hoog of ongeldig uitgooien maakt de eigen beurt ongeldig.", "Kom je boven de doelscore of voldoe je niet aan de gekozen finishregel, dan is de beurt bust. De eerste speler die correct finisht, wint."),
        ]),
        "Hitters-Challenge": ("ten-lives-screen.png", [
            ("Hitters Challenge", "Speel Doubles of Triples van 20 naar 10 en sluit af met Bull.", "Bij Hitters Challenge kies je doubles of triples. Je werkt van twintig terug naar tien en sluit af met bull."),
            ("Bewaar je pogingen", "Een treffer geeft de resterende pijlen plus drie nieuwe pogingen.", "Raak je het doel, dan neem je de resterende pijlen mee en krijg je drie nieuwe pogingen op het volgende doel."),
            ("Bescherm je levens", "Zonder treffer ga je terug; missen op 20 kost een leven.", "Zijn alle pogingen op, dan ga je één doel terug. Op twintig kost dit een leven. Wie bull bereikt voordat de levens op zijn, voltooit de challenge."),
        ]),
        "Bobs-27": ("screen-fit-bobs27-False.png", [
            ("Bob's 27", "Train alle dubbels van D1 tot en met D20 en daarna Bull.", "Bij Bob's zevenentwintig begin je met zevenentwintig punten en gooi je drie pijlen op iedere dubbel, van dubbel één tot dubbel twintig en daarna bull."),
            ("Raak of verlies punten", "Iedere treffer telt de dubbelwaarde erbij. Helemaal missen trekt die waarde af.", "Elke geraakte dubbel telt de dubbelwaarde bij je score op. Raak je met alle drie de pijlen niet, dan wordt die waarde afgetrokken."),
            ("Blijf boven nul", "Bij nul of lager val je af. Voltooi alle 21 rondes met de hoogste score.", "Komt je score op nul of lager, dan val je af. Voltooi je alle eenentwintig rondes, dan wordt jouw eindscore bewaard en vergeleken."),
        ]),
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
