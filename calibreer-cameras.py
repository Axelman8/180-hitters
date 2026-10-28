#!/usr/bin/env python3
"""Repair an AutoDarts three-camera setup and select 50 Hz anti-flicker.

Designed for a dedicated Linux NUC. The tool deliberately refuses ambiguous
camera sets and backs up all AutoDarts configuration before changing it.
"""
from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request


API = "http://127.0.0.1:3180"
CAPTURE = ":capture:"


class CameraError(RuntimeError):
    pass


def run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=check)


def udev_properties(device: str) -> dict[str, str]:
    result = run(["udevadm", "info", "--query=property", f"--name={device}"])
    return dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)


def usb_location(properties: dict[str, str]) -> str:
    # Examples: .../usb1/1-2/1-2:1.0/... and .../1-2/1-2.3/1-2.3:1.0/...
    # The segment immediately before the interface is the physical USB route.
    match = re.search(r"/([^/]+)/\1:[^/]+/video4linux/", properties.get("DEVPATH", ""))
    if not match:
        raise CameraError("USB-locatie kon niet worden bepaald.")
    return match.group(1)


def natural_key(value: str) -> list[object]:
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", value)]


def discover_cameras() -> list[dict[str, str]]:
    cameras = []
    for device in sorted(glob.glob("/dev/video*"), key=natural_key):
        props = udev_properties(device)
        if CAPTURE not in props.get("ID_V4L_CAPABILITIES", ""):
            continue
        if not props.get("ID_VENDOR_ID") or not props.get("ID_MODEL_ID"):
            continue
        location = usb_location(props)
        cameras.append({
            "native": device,
            "vid": props["ID_VENDOR_ID"].lower(),
            "pid": props["ID_MODEL_ID"].lower(),
            "serial": props.get("ID_SERIAL_SHORT", ""),
            "location": location,
        })
    return sorted(cameras, key=lambda camera: natural_key(camera["location"]))


def parse_device(value: str) -> dict[str, str]:
    return dict(item.split("=", 1) for item in value.split("&") if "=" in item)


def configured_devices(text: str) -> list[dict[str, str]]:
    cam = re.search(r"(?ms)^\[cam\]\s*$.*?(?=^\[|\Z)", text)
    if not cam:
        raise CameraError("De sectie [cam] ontbreekt in config.toml.")
    devices = re.search(r"(?ms)^devices\s*=\s*\[(.*?)^\]", cam.group(0))
    if not devices:
        raise CameraError("De cameralijst ontbreekt in config.toml.")
    return [parse_device(value) for _, value in re.findall(r"(['\"])(.*?)\1", devices.group(1))]


def map_slots(old: list[dict[str, str]], current: list[dict[str, str]]) -> list[dict[str, str]]:
    """Keep known native paths/ports first; use stable USB order as fallback."""
    if len(current) != 3:
        raise CameraError(f"Precies 3 camera's nodig; {len(current)} gevonden.")
    remaining = list(current)
    mapped: list[dict[str, str]] = []
    for slot in old[:3]:
        match = next((cam for cam in remaining if cam["native"] == slot.get("native")), None)
        if match is None:
            match = next((cam for cam in remaining if cam["location"] == slot.get("location")), None)
        if match is None:
            match = remaining[0]
        mapped.append(match)
        remaining.remove(match)
    mapped.extend(remaining)
    return mapped


def device_string(camera: dict[str, str]) -> str:
    fields = ["native", "vid", "pid", "serial", "location"]
    return "&".join(f"{key}={camera.get(key, '')}" for key in fields)


def replace_devices(text: str, cameras: list[dict[str, str]]) -> str:
    cam_match = re.search(r"(?ms)^\[cam\]\s*$.*?(?=^\[|\Z)", text)
    if not cam_match:
        raise CameraError("De sectie [cam] ontbreekt in config.toml.")
    section = cam_match.group(0)
    replacement = "devices = [\n" + "".join(f"    '{device_string(cam)}',\n" for cam in cameras) + "]"
    updated, count = re.subn(r"(?ms)^devices\s*=\s*\[.*?^\]", replacement, section, count=1)
    if count != 1:
        raise CameraError("De cameralijst kon niet veilig worden aangepast.")
    return text[:cam_match.start()] + updated + text[cam_match.end():]


def target_account(requested: str | None) -> tuple[str, Path, int, int]:
    candidates: list[str] = []
    if requested:
        candidates.append(requested)
    if os.environ.get("SUDO_USER") and os.environ["SUDO_USER"] != "root":
        candidates.append(os.environ["SUDO_USER"])
    candidates.extend(entry.pw_name for entry in pwd.getpwall() if entry.pw_uid >= 1000)
    seen = set()
    for user in candidates:
        if user in seen:
            continue
        seen.add(user)
        try:
            account = pwd.getpwnam(user)
        except KeyError:
            continue
        config = Path(account.pw_dir) / ".config/autodarts/config.toml"
        if config.is_file():
            return user, config, account.pw_uid, account.pw_gid
    raise CameraError("Geen AutoDarts-configuratie gevonden. Gebruik eventueel --user GEBRUIKER.")


def user_systemctl(user: str, uid: int, action: str) -> subprocess.CompletedProcess[str]:
    return run(["runuser", "-u", user, "--", "env", f"XDG_RUNTIME_DIR=/run/user/{uid}",
                "systemctl", "--user", action, "autodarts.service"], check=False)


def set_50hz(cameras: list[dict[str, str]]) -> None:
    if not shutil.which("v4l2-ctl"):
        raise CameraError("v4l2-ctl ontbreekt. Installeer eerst het pakket v4l-utils.")
    for camera in cameras:
        device = camera["native"]
        result = run(["v4l2-ctl", "-d", device, "--set-ctrl=power_line_frequency=1"], check=False)
        if result.returncode:
            raise CameraError(f"50 Hz instellen mislukt voor {device}: {result.stderr.strip()}")
        verify = run(["v4l2-ctl", "-d", device, "--get-ctrl=power_line_frequency"], check=False)
        if verify.returncode or not re.search(r"power_line_frequency:\s*1\b", verify.stdout):
            raise CameraError(f"{device} bevestigt de 50 Hz-instelling niet.")


def wait_for_api(seconds: int = 45) -> dict[str, object]:
    deadline = time.monotonic() + seconds
    last_error = ""
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(API + "/api/state", timeout=2) as response:
                state = json.load(response)
            if state.get("running"):
                return state
        except (OSError, ValueError) as error:
            last_error = str(error)
        time.sleep(1)
    raise CameraError("AutoDarts werd niet op tijd actief. " + last_error)


def start_calibration(attempts: int = 20) -> None:
    # AutoDarts 2.x rejects an empty form body/content-type with HTTP 400.
    # A bodyless POST is the API's expected calibration command.
    last = ""
    for attempt in range(attempts):
        request = urllib.request.Request(API + "/api/config/calibration/auto", method="POST")
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                if response.status in (200, 202, 204):
                    return
                last = f"HTTP {response.status}"
        except urllib.error.HTTPError as error:
            detail = error.read(1000).decode('utf-8', errors='replace').strip()
            last = f"HTTP {error.code}" + (f": {detail}" if detail else "")
            # AutoDarts reports 400 briefly while its camera graph is still
            # settling after a service restart. Retry only transient statuses.
            if error.code not in (400, 409, 425, 503):
                raise CameraError(f"Automatische kalibratie starten mislukt ({last}).") from error
        except OSError as error:
            last = str(error)
        if attempt + 1 < attempts:
            time.sleep(1)
    raise CameraError(f"Automatische kalibratie starten mislukt na {attempts} pogingen ({last}).")


def backup_files(config: Path, uid: int, gid: int) -> Path:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = config.parent / "180-hitters-backups" / stamp
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(config, backup / "config.toml")
    calibration = config.with_name("calibration.json")
    if calibration.is_file():
        shutil.copy2(calibration, backup / "calibration.json")
    for path in [backup.parent, backup, *backup.iterdir()]:
        os.chown(path, uid, gid)
    return backup


def print_cameras(cameras: list[dict[str, str]]) -> None:
    for index, camera in enumerate(cameras, 1):
        print(f"  Camera {index}: {camera['native']} op USB-slot {camera['location']} "
              f"({camera['vid']}:{camera['pid']})")


def main() -> int:
    parser = argparse.ArgumentParser(description="AutoDarts-camera's detecteren, op 50 Hz zetten en kalibreren.")
    parser.add_argument("--user", help="Linux-gebruiker waaronder AutoDarts draait")
    parser.add_argument("--yes", action="store_true", help="bevestiging van een leeg bord overslaan")
    parser.add_argument("--frequency-only", action="store_true", help="alleen 50 Hz toepassen; voor opstartservice")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise CameraError("Start dit commando met sudo: sudo calibreer-cameras")

    cameras = discover_cameras()
    if args.frequency_only and len(cameras) != 3:
        # USB initialization can finish after the system reaches multi-user.target.
        for _ in range(30):
            time.sleep(1)
            cameras = discover_cameras()
            if len(cameras) == 3:
                break
    if len(cameras) != 3:
        raise CameraError(f"Precies 3 USB-capturecamera's nodig; {len(cameras)} gevonden. Niets gewijzigd.")
    print("Gevonden camera's:")
    print_cameras(cameras)

    if args.frequency_only:
        set_50hz(cameras)
        print("Alle drie camera's staan op 50 Hz.")
        return 0

    user, config, uid, gid = target_account(args.user)
    original = config.read_text(encoding="utf-8")
    old = configured_devices(original)
    mapped = map_slots(old, cameras)
    print(f"AutoDarts-gebruiker: {user}")
    print("Nieuwe vaste volgorde:")
    print_cameras(mapped)
    if not args.yes:
        answer = input("Maak het dartbord helemaal leeg. Typ daarna JA om door te gaan: ").strip().casefold()
        if answer != "ja":
            print("Gestopt; er is niets gewijzigd.")
            return 2

    backup = backup_files(config, uid, gid)
    updated = replace_devices(original, mapped)
    temporary = config.with_suffix(".toml.tmp")
    temporary.write_text(updated, encoding="utf-8")
    os.chown(temporary, uid, gid)
    os.replace(temporary, config)
    print(f"Back-up opgeslagen in {backup}")

    restart = user_systemctl(user, uid, "restart")
    if restart.returncode:
        # Restore immediately if the installed service cannot be controlled.
        shutil.copy2(backup / "config.toml", config)
        os.chown(config, uid, gid)
        raise CameraError("AutoDarts herstarten mislukte; configuratie is hersteld. " + restart.stderr.strip())
    wait_for_api()
    # Camera controls may reset when the stream is reopened, so apply them last.
    set_50hz(mapped)
    start_calibration()
    print("Automatische kalibratie is gestart.")
    print("Controleer na afloop in AutoDarts met drie bekende worpen of de scores kloppen.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CameraError as error:
        print(f"FOUT: {error}", file=sys.stderr)
        raise SystemExit(1)
