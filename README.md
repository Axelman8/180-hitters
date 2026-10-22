# 180 Hitters

Zelfstandige Nederlandstalige darts-scoreapp voor Android, touchscreen en Linux-NUC. Ontwikkeld door [Axelman8](https://github.com/axelman8). Geen camera, account, abonnement of internet nodig tijdens het spelen. De app gebruikt Python 3 als lokale webserver en een moderne browser. Geen npm-installatie nodig.

## Op Linux installeren

Voor een nieuwe Linux-NUC download je `180-Hitters-Linux-x64.tar.gz` van de nieuwste GitHub-release. Pak het uit en voer `sudo bash setup-linux.sh` uit. Dit installeert de app, kioskstart, Bluetooth, de beveiligde NUC-bediening en een `180 Hitters wifi`-noodhotspot. Bestaande locatiegegevens en partijen blijven bij herinstallatie behouden.

Voor Windows 10/11 download je `180-Hitters-Windows-x64.zip`, pak je het uit en dubbelklik je `install-windows.cmd`. De Windows-versie werkt lokaal en via het eigen LAN; Bluetooth-NUC-bediening en wifi instellen vanuit de telefoon zijn Linux-functies.

Voor Ubuntu/Debian met een grafische desktop en systemd. De bestaande Autodarts-installatie wordt niet verwijderd. Schakel eventueel de bestaande Autodarts-autostart uit om te voorkomen dat twee kioskvensters openen.

1. Pak de volledige map uit op de NUC.
2. Installeer Python 3 (`sudo apt install python3`) en Chromium of Firefox via de softwarewinkel indien nodig.
3. Open een terminal in deze map en voer `bash install-linux.sh` uit **als je gewone desktopgebruiker, zonder sudo**.
4. Open <http://127.0.0.1:8765>. Bij de volgende desktopaanmelding start de browser in kioskmodus.

Het installatiescript kopieert de app naar `~/.local/share/oche-darts`, registreert een gebruikersservice en voegt browser-autostart toe. Opnieuw uitvoeren werkt de app bij; browsergegevens en de gedeelde partij blijven behouden. Herstart na een update de service met `systemctl --user restart oche-darts`. Configureer automatische desktopaanmelding en schakel schermvergrendeling/slaapstand uit in de Linux-instellingen als je direct na het aanzetten wilt spelen. Gebruik Alt+F4 om kioskmodus te sluiten; F11 schakelt volledig scherm in een gewoon browservenster.

Zonder installatie starten: `python3 server.py` (op Windows: `python server.py`). Open daarna <http://127.0.0.1:8765>. Houd de terminal open. De server is ook bereikbaar op het lokale netwerk via poort 8765. Gebruik uitsluitend een vertrouwd netwerk; deelnemers op dat netwerk kunnen de partij bedienen. De knop Mobiel toont de adressen.

## Spelen

- X01 met 121, 170, 301, 501, 701 of 901. Straight-, double- of master-in en straight-, double- of master-out. Master betekent dubbel of triple.
- Cricket (15–20 en bull) en Tactics (10–20 en bull), met Standard, Cut Throat of No Score. Eén tot vier spelers.
- Wedstrijdvorm: eerste tot 1–10 legs of sets, of vrij spelen. Bij sets kies je hoeveel legs nodig zijn per set; bij vrij spelen kun je na iedere leg doorgaan of afronden. Sets en totale legs worden apart bijgehouden.
- **Beurttotaal:** beschikbaar bij X01 met straight-in en 25/50-bull. Voer de som van drie pijlen in. Bij een finish geef je het aantal gebruikte pijlen op en bevestig je dat de laatste pijl aan de gekozen uitgooiregel voldeed.
- **Per pijl:** selecteer Single, Double of Triple en vervolgens 1–20. De vermenigvuldiger gaat na iedere pijl terug naar Single. De knoppen 25, Bull (50) en Mis zijn vaste waarden. Een beurt eindigt direct bij een finish of bust; voeg dan geen extra pijlen toe.
- Bust geeft nul punten voor de hele beurt en herstelt de score van vóór de beurt. Een bust telt als drie pijlen voor het gemiddelde, ook bij een eerdere bust.
- Checkoutadvies toont één mogelijke route volgens de uitgooiregel. Binnenbull telt als dubbel. Bij 50/50-bull scoort buitenbull 50 maar blijft het een single: geen double/master-in of double/master-out via de buitenbull. Deze expliciete lokale interpretatie voorkomt dat alleen de puntenwaarde als dubbel geldt.
- Bij double/master-in tellen pijlen pas vanaf de openingspijl. Een bust herstelt ook de openingsstatus van vóór de beurt. Invoer per pijl is verplicht bij double/master-in en 50/50-bull.
- Kies de starter handmatig, eventueel na een fysieke bull-off. Vervolgens wisselt de starter per leg door tussen alle spelers. Er is geen automatische afstandsmeting.
- Gemiddelden, beste beurten en geschiedenis lopen over de hele partij. Herstellen draait de laatste beurt terug, ook over een leggrens. Maximaal 500 beurten herstelgeschiedenis.
- Een partij wordt in de lokale browseropslag bewaard en na herladen hervat. Gebruik steeds dezelfde browser en hetzelfde profiel/adres; wis geen browsergegevens. Een nieuwe partij vervangt de vorige. Er is nog geen archief van eerdere partijen.

## Hardware en grenzen

Ontworpen voor touchscreens vanaf 1024 × 768, met een aangepaste indeling voor smallere schermen. De app is licht en gebruikt geen GPU-versnelling of cameraverwerking; een Intel i5-NUC is ruim voldoende. De concrete NUC, Linux-driver voor het touchscreen en kiosk-autostart moeten nog op het apparaat worden gecontroleerd. Voor spelersnamen verschijnt het schermtoetsenbord alleen als dit in de desktop is ingeschakeld. De scores gebruiken het ingebouwde aanraaktoetsenbord.

## Cricket en Tactics

Voer de pijlen in met Single, Double of Triple gevolgd door het doelnummer. Gebruik **Mis** ook voor treffers buiten de doelen van de spelvariant. Buitenbull geeft één treffer, binnenbull twee. Een doel sluit na drie treffers; het bord toont `/`, `×` en `⊗`. Groen betekent gesloten terwijl een ander het doel nog open heeft; oranje betekent gesloten door iedereen.

- **Standard:** extra treffers geven jou punten zolang minstens één tegenstander het doel open heeft. Ook overtollige treffers binnen dezelfde pijl tellen. Sluit alle doelen en heb minstens evenveel punten als iedere tegenstander.
- **Cut Throat:** extra treffers geven punten aan iedere tegenstander die het doel open heeft. Sluit alles met de laagste (of gedeeld laagste) score.
- **No Score:** sluit alle doelen als eerste; punten spelen geen rol.

De beurt eindigt direct bij winst; voer daarna geen extra pijlen in. Het gemiddelde is effectieve marks per drie pijlen: sluitingstreffers plus treffers die daadwerkelijk punten kunnen opleveren. Bij No Score tellen alleen sluitingstreffers. De beste beurt gebruikt dezelfde telling. Een nieuwe leg wist het sluitingsbord en de legpunten; partijstatistieken blijven staan.

## Rondelimiet en gelijkspel

Kies onbeperkt, 15, 20, 50 of 80 rondes. Elke speler krijgt evenveel beurten voordat de limiet wordt beoordeeld. X01 gebruikt de laagste resterende score; Cricket/Tactics Standard de hoogste punten, Cut Throat de laagste en No Score het grootste aantal sluitingstreffers. Bij een gelijke stand worden volledige extra rondes gespeeld totdat er één leider is, of iemand normaal uitgooit/sluit. Dit is een expliciete lokale beslisregel; exacte gelijkspelregels staan niet uitgewerkt in de geraadpleegde Autodarts-documentatie.

## Overeenkomst met Autodarts

De spelinstellingen zijn zelfstandig geïmplementeerd met de officiële [X01-documentatie](https://docs.autodarts.com/game-modes/x01/) en [Cricket/Tactics-documentatie](https://docs.autodarts.com/game-modes/cricket-tactics/) als functionele referentie (18 oktober 2026). Dit is geen Autodarts-client. De code, accounts en diensten van Autodarts zijn niet gekoppeld.

Niet inbegrepen: Hidden Cricket, bots, andere oefen-/partyspellen, online tegenstanders, matchmaking, competities, cameradetectie, AI-referee en uitgebreide historische statistieken/heatmaps. De huidige partij en herstelgeschiedenis worden lokaal opgeslagen; er is geen archief van afgesloten partijen. Een bestaande X01-partij uit versie 1 wordt automatisch ingelezen.

## Testen

De spelregeltests staan in [dist/tests/engine.test.js](dist/tests/engine.test.js). Start de lokale server en voer in de browserconsole uit: `const {runTests} = await import('/tests/engine.test.js'); runTests();`. De suite controleert 53 scenario's, waaronder busts, in/out-regels, sets, sluiting, puntentoekenning, winstvoorwaarden en rondelimieten. Touchinvoer, hervatten en herstellen zijn daarnaast in de browser gecontroleerd. Linux-autostart en de fysieke NUC zijn nog niet getest.

## Autostart uitschakelen

Voer `systemctl --user disable --now oche-darts.service` uit en verwijder het bestand `~/.config/autostart/oche-darts.desktop`. Bewaar het browserprofiel als je de huidige partij wilt behouden.


## Mobiele score-invoer

Alle apparaten gebruiken dezelfde partij op de NUC. Bevestigde beurten, ongedaan maken en een nieuwe leg worden gesynchroniseerd. Losse pijlen worden live gedeeld tussen scherm en mobiel, ook bij alle X01 dubbel-in startscores. Je kunt een pijl op het andere apparaat wissen of de beurt daar afmaken. Een beurttotaal dat nog niet bevestigd is blijft op het invoerende apparaat. Gebruik voor elke beurt een apparaat. Gelijktijdige wijzigingen worden gecontroleerd: een verouderde invoer overschrijft geen nieuwere stand.

Bij verbindingsverlies wordt invoer geblokkeerd. Controleer na herstel de stand voordat je een beurt opnieuw invoert. De partij wordt atomair opgeslagen in `match.json` naast de server. Bij de eerste start neemt het NUC-scherm zijn bestaande lokaal opgeslagen partij over. Start de eerste partij op het NUC-scherm voordat je een mobiel gebruikt.

Deze NUC krijgt wifi `180 Hitters wifi` met adres http://10.42.0.1:8765. Een telefoon moet verbonden blijven met dit netwerk, ook als hij meldt dat het geen internet heeft. Een eigen hotspot en de bestaande wifi-clientverbinding gebruiken dezelfde adapter en kunnen hier niet tegelijk worden gebruikt. Een netwerkkabel kan worden gebruikt voor beheer/internet naast de hotspot.

## Training: 121 - negen darts

Kies Training als aparte spelcategorie. Deze solo-oefening begint op 121, met invoer per pijl en dubbel-uit. Bij uitgooien stijgt de volgende startscore met 1 plus het aantal overgebleven darts van de negen. Uit in vier darts geeft dus +6: 121 wordt 127. Na negen darts zonder finish daalt de volgende startscore met 1, nooit onder 121. Een bust verbruikt de rest van de beurt. Het scherm toont het niveau, beste niveau en resterende darts.

## Training: Gotcha

2-4 spelers, vanaf nul naar precies 301. Elke pijl telt; een gelijkgeraakte tegenstander wordt direct teruggezet op nul. Bij overschrijden van 301 eindigt de beurt en keert alleen de eigen score terug naar het begin van de beurt. Eerdere resets blijven staan. Single-out, bull 25/50, geen rondelimiet. Regels: https://www.flyordie.com/games/help/darts/en/game_rules_301.html en https://docs.autodarts.com/game-modes/party/gotcha/. De bronnen specificeren niet expliciet of een eerdere reset bij een latere bust vervalt; deze app behoudt de reset en benoemt dat in de speluitleg.

Gotcha heeft nu doelscores 301/401/501/601/701 en Straight-, Double- of Master-out. Bij Double/Master-out is een ongeldige finish of 1 resterend een bust. De beurt gaat automatisch door na de laatste pijl of een bust.

## Spelerslijst

Via Spelerslijst op scherm en mobiel voeg je namen toe en verwijder je ze. De lijst is gedeeld, alfabetisch gesorteerd en opgeslagen in match-players.json naast match.json. Namen zijn maximaal 24 tekens; hoofdletterverschillen maken geen dubbele naam. Elk spel biedt bij de spelersnamen een keuzelijst; een losse naam typen blijft mogelijk. Verwijderen uit de lijst verandert een lopende partij niet.

121 ondersteunt 1-4 spelers. Elke speler speelt een volledige poging van maximaal negen darts. Daarna kies je Volgende speler. Niveaus en beste niveaus worden per speler bewaard. De starter kan worden gekozen.

## Voorkeursroutes checkout

Double-out gebruikt de numerieke routes van de Winmau PDC Checkout Table (https://winmau.com/products/winmau-out-shot-calculator-card-x0968). Deze kaart begint bij 41; onder 41 kiest de app directe dubbels of een single naar D16/D8/D4/D2/D1, zoals 25 = S9 D8. Wanneer de kaartroute niet past binnen het aantal resterende pijlen of de bullinstelling, zoekt de app een geldige alternatieve route. Straight- en Master-out behouden hun eigen finishregels.


## Wifi / hotspot vanaf de mobiel

De Android-app kan via Bluetooth of wifi een nieuw WPA2-netwerk op de Linux-NUC opslaan. Vul de SSID en het wachtwoord in bij **Wifi / hotspot**. De NUC maakt direct een standaard wifi-QR op het hoofdscherm en neemt het netwerk op in de keuzelijst. Het wachtwoord wordt niet teruggestuurd naar browsers.

Na bevestiging start een onafhankelijke systemd-taak de verbinding; na vier seconden kan de telefoon de wifi-verbinding verliezen, terwijl Bluetooth beschikbaar blijft. Bij mislukken (35 seconden verbindpoging) probeert de NUC `180 Hitters wifi`, en als ook dat mislukt de vorige verbinding. Bij een defecte of uitgeschakelde adapter is herstel niet gegarandeerd.

`setup-linux.sh` regelt dit bij een nieuwe installatie. Handmatig kan het met `sudo bash install-network-control.sh`. De root-eigen helper accepteert alleen begrensde SSID/wachtwoordgegevens of UUIDs uit `/etc/darts-network.json`; de webserver krijgt geen algemene shelltoegang.

Status en resultaat zijn beschikbaar via `/api/network/control`; omschakelen gebeurt via JSON POST `/api/network/switch` met uitsluitend `uuid`. Bewaar de mobiele pagina als bladwijzer. Op `180 Hitters wifi`: `http://10.42.0.1:8765/?remote=1`; op andere wifi: scan de QR-code op het NUC-scherm. De knop beheert uitsluitend opgeslagen verbindingen, geen nieuwe wachtwoorden.

## Herbruikbaar locatieprofiel

Dezelfde app en APK werken neutraal, thuis en bij verschillende verenigingen. Kies op de NUC of in de Android-app **Menu → Locatie** om de locatienaam, plaats, naam van de clubspelerslijst, slogan, screensaver, logo, achtergrond en optionele clubwifi-QR in te stellen. Zonder profiel gebruikt de app `180 Hitters`, `Clubspelers` en een algemene screensaver.

Het profiel staat als `venue.json` naast `server.py` en wordt niet opgenomen in GitHub-releases of vervangen door updates. Via wifi en Bluetooth leest de Android-app automatisch het profiel van de gekoppelde NUC. In lokale telefoonmodus wordt een afzonderlijk neutraal of persoonlijk profiel op de telefoon bewaard. De 180 Hitters-hotspot blijft centraal via NetworkManager beheerd; naam en wachtwoord in het profiel zijn uitsluitend de bijbehorende gebruikersinstructie.
