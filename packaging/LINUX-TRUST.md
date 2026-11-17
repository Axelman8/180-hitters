# Linux installation and package trust

Download [DartsApp-Ubuntu-Debian-amd64.deb](https://github.com/Axelman8/180-hitters/releases/latest/download/DartsApp-Ubuntu-Debian-amd64.deb) on the NUC, open it with the Linux package installer and confirm using the Linux administrator password. The package includes the app, its signed software source and the source-specific public verification key. Existing player lists and saved games are migrated by the installer.

This first approval cannot be made by the downloaded file itself. Ubuntu/Debian do not automatically trust every file merely because its developer signed it. A script execution warning, an untrusted desktop launcher and an APT repository signature failure are separate issues. The signed source provides a verifiable chain for subsequent package-manager downloads; it does not disable these other controls or guarantee acceptance on every unknown NUC.

## What Linux verifies

- Source: `https://axelman8.github.io/180-hitters/apt/`
- Package: `dartsapp`, architecture `amd64`.
- Key: `/usr/share/keyrings/180-hitters-archive-keyring.gpg`.
- Source configuration: `/etc/apt/sources.list.d/180-hitters.sources`.
- Public key fingerprint: `8DB37E731BD263FAB214B31B6391D9835B3A1B4A`.

The source uses `Signed-By`, so its key only authenticates 180 Hitters. No `trusted=yes`, `allow-unauthenticated` or global trust override is used. APT checks the signed `InRelease` metadata, the hash of `Packages` and the package's SHA-256 digest. The publisher also provides a detached installer signature and the public key in the repository. This is independent of the app's existing GitHub update flow.

The source is republished only after its tests pass, after successful app releases, or weekly to refresh its expiry date. Signing keys are held in encrypted GitHub Actions secrets; only the public key is included in source control and installers. Removing the app removes its source and verification key together.

## Older installations

For a 1.8.22 installation, install the new `.deb` once over the old application. Older app versions cannot acquire package-manager trust merely by downloading a newer script. If the graphical package installer refuses the package, do not disable Linux's verification: its installation log is needed to distinguish a missing key, a damaged download, unsupported dependencies or a desktop launch warning.

The supported terminal alternative, from the directory containing the downloaded package, is:

```sh
sudo apt install ./DartsApp-Ubuntu-Debian-amd64.deb
```

After the source is installed, the usual Linux software tools can install the signed package:

```sh
sudo apt update
sudo apt install dartsapp
```

Installing system software still requires administrator approval. On a new machine the operating system decides how that approval is displayed.
