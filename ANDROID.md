# 180 Hitters Android

De Android-app gebruikt exact dezelfde bestanden uit `dist` als de NUC. Gradle kopieert deze bestanden tijdens elke build; onderhoud daarom nooit een tweede kopie van de webinterface.

## Modi

- **Lokaal:** de ingebouwde Android-server gebruikt `127.0.0.1:8765`. Hiervoor is geen wifi, NUC of internet nodig.
- **NUC via Bluetooth:** de interface draait lokaal op de telefoon en wisselt score- en spelersgegevens via Bluetooth Classic uit met de NUC. Wifi en internet zijn niet nodig. Koppel de telefoon één keer met apparaat `darten`.
- **NUC via wifi:** opent de NUC via het ingestelde HTTP-adres. Vanuit deze modus kan Bluetooth op de NUC weer worden aangezet.
- Bij overschakelen van NUC naar lokaal kan de laatst bevestigde NUC-stand worden overgenomen.
- **De Venhoeve** is de centrale spelerslijst van de NUC en kan alleen op het NUC-scherm worden beheerd.
- **Mijn spelers** wordt in de Android-app bewaard, werkt offline en wordt bij een NUC-verbinding als aparte lijst naar de NUC gesynchroniseerd.

## Bouwen en aanbieden

1. De draagbare JDK, Gradle en Android SDK staan onder `.tools` en wijzigen de Windows-installatie niet.
2. Voer `build-android.ps1` uit.
3. Het resultaat komt in `dist/downloads/180-Hitters.apk`.
4. Voer daarna op de NUC opnieuw `bash install-linux.sh` uit. De knop **Android-app** toont een QR-code naar de APK op de NUC.

Behoud de ondertekeningssleutel waarmee de eerste definitieve APK wordt gebouwd. Alleen APK's met dezelfde sleutel kunnen als update over de bestaande app worden geïnstalleerd.
De sleutel staat lokaal in `android/keystore/axelman8-release.jks` en wordt niet door Git meegenomen. Maak hiervan een veilige back-up.

## NUC-installatie

`install-linux.sh` installeert ook de Bluetooth-brug. Voer daarnaast één keer `sudo bash install-system-control.sh` uit voor de afgeschermde knoppen Bluetooth aan/uit, herstarten en uitschakelen. Ingrijpende acties vragen in de Android-app altijd om bevestiging.
