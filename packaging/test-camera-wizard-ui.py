"""Run under Xvfb on the release runner; all camera/desktop actions are mocked."""
import importlib.util
from pathlib import Path
import tempfile
import tkinter as tk
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('wizard', Path(__file__).with_name('camera-setup.py'))
wizard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wizard)
root = tk.Tk()
failures = []
def inspect():
    try:
        buttons = [w for w in root.winfo_children() if isinstance(w, tk.Button)]
        assert len(buttons) == 5
        assert all(w.winfo_y()+w.winfo_height() <= root.winfo_height() for w in root.winfo_children())
        buttons[1].invoke()
    except Exception as e:
        failures.append(repr(e))
    root.after(600, finish)
def finish():
    try:
        labels = [w.cget('text') for w in root.winfo_children() if isinstance(w, tk.Label)]
        assert any('AutoDarts geopend' in text for text in labels), labels
    except Exception as e:
        failures.append(repr(e))
    root.destroy()
with tempfile.TemporaryDirectory() as directory:
    wizard.CONFIG = Path(directory)
    with patch.object(tk, 'Tk', return_value=root), patch.object(wizard, 'shortcuts'), patch.object(wizard, 'install_detector'), patch.object(wizard, 'launch_detector'):
        root.after(200, inspect)
        wizard.main()
assert not failures, failures
print('PASS graphical wizard layout, installation button and background result')
