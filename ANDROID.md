# 180 Hitters for Android

The Android app uses the same files from `dist` as the NUC. Gradle copies these files into the app during every build, so the web interface must never be maintained as a separate Android-specific copy.

## Modes

- **Standalone:** the embedded Android server runs on `127.0.0.1:8765`. No Wi-Fi, NUC, or internet connection is required.
- **NUC over Bluetooth:** the interface runs locally on the phone and exchanges match and player data with the NUC over Bluetooth Classic. Pair the phone with the NUC once.
- **NUC over Wi-Fi:** opens the configured NUC HTTP address. This mode can also request the NUC to enable Bluetooth again.
- When switching from a NUC to standalone mode, the latest confirmed NUC match can be imported.
- The venue player list is stored centrally on the NUC and can only be edited on the NUC display.
- **My players** is stored in the Android app, works offline, and synchronizes to the NUC as a separate list.

## Build and distribution

1. The portable JDK, Gradle, and Android SDK are stored under `.tools` and do not modify the Windows installation.
2. Run `build-android.ps1`.
3. The signed result is written to `dist/downloads/180-Hitters.apk`.
4. GitHub Actions publishes the APK and checksums when a version tag is pushed.

Keep a secure backup of the signing key used for the first production APK. Android only accepts an update when it is signed with the same key. The local key at `android/keystore/axelman8-release.jks` and its passwords are excluded from Git.

## NUC integration

`install-linux.sh` installs the Bluetooth bridge. The complete `setup-linux.sh` installer also configures the restricted system and network helpers. Privileged operations such as restart and shutdown always require confirmation in the Android app.
