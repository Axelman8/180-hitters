"""Per-user graphical setup. Never installs third-party code as root."""
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

HOME = Path.home()
CONFIG = HOME / '.config/180-hitters'
APPIMAGE = HOME / '.local/bin/autodarts-desktop.AppImage'
MARKER = Path('/etc/dartsapp/camera-enabled')


def detector():
    try:
        with urllib.request.urlopen('http://127.0.0.1:3180/api/state', timeout=2) as r:
            return json.load(r)
    except (OSError, ValueError):
        return {}


def shortcuts():
    result = subprocess.run(['xdg-user-dir', 'DESKTOP'], capture_output=True, text=True)
    desktop = Path(result.stdout.strip()) if result.returncode == 0 and result.stdout.strip() else None
    # Do not guess a translated desktop name or put launchers directly in HOME.
    if not desktop or not desktop.is_absolute() or desktop == HOME:
        return
    desktop.mkdir(parents=True, exist_ok=True)
    for name in ('dartsapp', 'dartsapp-camera'):
        target = desktop / (name + '.desktop')
        shutil.copy2('/usr/share/applications/' + name + '.desktop', target)
        target.chmod(0o755)
        subprocess.run(['gio', 'set', str(target), 'metadata::trusted', 'true'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def launch_detector():
    if detector().get('running'):
        return
    # Respect an existing headless installation instead of competing for cameras.
    if subprocess.run(['systemctl', '--user', 'is-active', '--quiet', 'autodarts.service']).returncode == 0:
        return
    if not APPIMAGE.is_file():
        raise RuntimeError('Installeer eerst de camerasoftware met stap 1.')
    env = dict(os.environ, APPIMAGE_EXTRACT_AND_RUN='1')
    subprocess.Popen([str(APPIMAGE)], env=env, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True)


def open_game():
    subprocess.Popen(['xdg-open', 'http://127.0.0.1:8765'],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def install_detector():
    if APPIMAGE.is_file() or detector().get('running'):
        return
    # Download directly from the official publisher, not redistributed in our deb.
    with tempfile.TemporaryDirectory(prefix='hitters-camera-') as directory:
        script = Path(directory) / 'install.sh'
        subprocess.run(['curl', '--fail', '--location', '--proto', '=https',
                        '--tlsv1.2', '--connect-timeout', '15', '--max-time', '90',
                        'https://autodarts.sh', '--output', str(script)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log = CONFIG / 'camera-install.log'
        with log.open('w') as output:
            result = subprocess.run(['bash', str(script), '--desktop'], stdout=output,
                                    stderr=subprocess.STDOUT, timeout=900)
        if result.returncode or not APPIMAGE.is_file():
            raise RuntimeError('Installeren lukte niet. Controleer internet en probeer opnieuw. '
                               'Details: ' + str(log))


def main():
    automatic = '--autostart' in sys.argv
    if automatic and not MARKER.exists():
        return
    if os.geteuid() == 0:
        raise SystemExit('Start Camera’s instellen vanuit de aangemelde gebruiker, niet als root.')
    CONFIG.mkdir(parents=True, exist_ok=True)
    import fcntl
    lock = (CONFIG / 'setup.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    shortcuts()
    if automatic and (CONFIG / 'ready').exists():
        try:
            launch_detector()
            open_game()
            return
        except RuntimeError:
            pass
    import tkinter as tk
    from tkinter import messagebox
    window = tk.Tk()
    window.title('180 Hitters — camera’s instellen')
    window.geometry('720x760')
    window.configure(bg='#10232b')
    def label(text, size=13):
        tk.Label(window, text=text, bg='#10232b', fg='white', font=('Sans', size),
                 wraplength=650, justify='left').pack(padx=28, pady=10, anchor='w')
    label('Welkom bij 180 Hitters', 25)
    label('Sluit de drie USB-camera’s aan en zet de bordverlichting aan. '
          'Ubuntu 22.04/24.04 Desktop, Intel/AMD 64-bit en internet zijn nodig.')
    label('De camera’s gebruiken AutoDarts. Log eenmalig in met je eigen account en '
          'stel jouw bord en camera’s in. Kalibratie hoort bij dit bord; '
          'die wordt niet van een andere NUC overgenomen.')
    status = tk.StringVar(value='Begin met stap 1. Handmatig spelen kan altijd.')
    messages = queue.Queue()
    buttons = []
    def work(fn, success):
        for b in buttons: b.configure(state='disabled')
        status.set('Even wachten… downloaden kan enkele minuten duren.')
        def run():
            try:
                fn()
                messages.put((True, success))
            except Exception as error:
                messages.put((False, str(error)))
        threading.Thread(target=run, daemon=True).start()
    def installed():
        install_detector()
        launch_detector()
    def check():
        state = detector()
        if not state.get('running'):
            raise RuntimeError('Camera’s nog niet actief. Rond stap 2 af in AutoDarts: '
                               'inloggen, bord kiezen, camera’s kiezen en kalibreren. '
                               'Laat AutoDarts open of activeer daar de achtergrondservice.')
        with urllib.request.urlopen('http://127.0.0.1:8765/api/autoscoring', timeout=3) as r:
            bridge = json.load(r)
        if not bridge.get('connected'):
            raise RuntimeError('180 Hitters ziet AutoDarts nog niet. Wacht even en controleer opnieuw.')
        (CONFIG / 'ready').write_text('1\n')
    for title, fn, success in [
        ('1  Camerasoftware installeren', installed, 'AutoDarts geopend. Volg daar de stappen voor inloggen en kalibreren.'),
        ('2  Camera’s instellen / AutoDarts openen', launch_detector, 'Rond de inrichting in AutoDarts af. Keer daarna hier terug.'),
        ('3  Verbinding controleren', check, 'Verbonden! Test de herkenning eerst in AutoDarts. Open daarna 180 Hitters, start een partij en kies Instellingen → Camera-invoer op NUC → aan.')]:
        b = tk.Button(window, text=title, command=lambda f=fn,s=success: work(f,s),
                      font=('Sans',15), bg='#246474', fg='white', pady=12)
        b.pack(fill='x', padx=28, pady=5); buttons.append(b)
    tk.Label(window, textvariable=status, wraplength=650, bg='#10232b', fg='#cfef73',
             font=('Sans',12), justify='left').pack(padx=28, pady=14, anchor='w')
    tk.Button(window, text='180 Hitters openen / handmatig spelen', command=open_game,
              font=('Sans',14), bg='#cfef73', pady=12).pack(fill='x', padx=28, pady=5)
    label('De bureaubladicoontjes zijn aangemaakt. Verschijnt “Niet vertrouwd”? '
          'Klik rechts op het icoon en kies “Starten toestaan”.', 10)
    def poll():
        try:
            ok, text = messages.get_nowait()
            status.set(text)
            for b in buttons: b.configure(state='normal')
            if not ok: messagebox.showerror('Controle nodig', text)
        except queue.Empty:
            pass
        window.after(200, poll)
    poll()
    window.mainloop()


if __name__ == '__main__':
    main()
