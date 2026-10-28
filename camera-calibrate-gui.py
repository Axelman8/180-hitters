#!/usr/bin/env python3
"""Small desktop front end for the root-owned camera calibration helper."""
from __future__ import annotations

import getpass
import os
from pathlib import Path
import shutil
import subprocess
import tkinter as tk
from tkinter import messagebox


HELPER_PATHS = (Path('/usr/local/sbin/calibreer-cameras'), Path('/usr/sbin/calibreer-cameras'))


def helper_path() -> Path | None:
    return next((path for path in HELPER_PATHS if path.is_file() and os.access(path, os.X_OK)), None)


def calibrate(window: tk.Tk, status: tk.StringVar, button: tk.Button) -> None:
    helper = helper_path()
    if helper is None:
        messagebox.showerror(
            "Camera's kalibreren",
            "Het camera-hulpprogramma ontbreekt. Installeer eerst de nieuwste "
            "180 Hitters NUC-installatie.",
            parent=window,
        )
        return
    if not shutil.which('pkexec'):
        messagebox.showerror("Camera's kalibreren", "pkexec ontbreekt op deze NUC.", parent=window)
        return
    if not messagebox.askyesno(
        "Bord leeg?",
        "Haal alle darts uit het bord en zet de bordverlichting aan.\n\n"
        "Camera's worden op 50 Hz gezet, de USB-slots worden gecontroleerd "
        "en AutoDarts wordt opnieuw gekalibreerd. Doorgaan?",
        parent=window,
    ):
        return
    button.configure(state='disabled')
    status.set("Beheerderswachtwoord bevestigen…")
    window.update_idletasks()
    result = subprocess.run(
        ['pkexec', str(helper), '--yes', '--user', getpass.getuser()],
        text=True,
        capture_output=True,
    )
    button.configure(state='normal')
    if result.returncode == 0:
        status.set("Kalibratie gestart. Test hierna drie bekende worpen in AutoDarts.")
        messagebox.showinfo(
            "Kalibratie gestart",
            "De drie camera's staan op 50 Hz en AutoDarts is opnieuw gestart. "
            "Wacht tot de kalibratie klaar is en test daarna drie bekende worpen.",
            parent=window,
        )
    elif result.returncode == 126:
        status.set("Geannuleerd; niets aangepast.")
    else:
        detail = (result.stderr or result.stdout or "Onbekende fout").strip()[-1200:]
        status.set("Kalibratie mislukt; de bestaande back-up blijft beschikbaar.")
        messagebox.showerror("Kalibratie mislukt", detail, parent=window)


def main() -> None:
    window = tk.Tk()
    window.title("180 Hitters – camera's kalibreren")
    window.geometry('620x380')
    window.resizable(False, False)
    window.configure(bg='#10232b')
    tk.Label(window, text="Camera's opnieuw kalibreren", bg='#10232b', fg='white',
             font=('Sans', 23, 'bold')).pack(padx=28, pady=(30, 14))
    tk.Label(window,
             text="Voor drie vaste USB-camera's op een Linux NUC. Het hulpprogramma "
                  "detecteert de actuele USB-slots, zet alle camera's op 50 Hz, maakt "
                  "een back-up en start de AutoDarts-kalibratie.",
             bg='#10232b', fg='white', font=('Sans', 13), wraplength=550,
             justify='left').pack(padx=34, pady=10)
    status = tk.StringVar(value="Maak eerst het dartbord helemaal leeg.")
    button = tk.Button(window, text="50 Hz instellen en kalibreren",
                       font=('Sans', 15, 'bold'), bg='#cfef73', fg='#10232b', pady=13)
    button.configure(command=lambda: calibrate(window, status, button))
    button.pack(fill='x', padx=44, pady=20)
    tk.Label(window, textvariable=status, bg='#10232b', fg='#cfef73',
             font=('Sans', 11), wraplength=540).pack(padx=34, pady=5)
    window.mainloop()


if __name__ == '__main__':
    main()
