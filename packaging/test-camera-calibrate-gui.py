"""Offline checks for the clickable AutoDarts calibration launcher."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import tkinter as tk
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('camera_gui', Path(__file__).parents[1] / 'camera-calibrate-gui.py')
camera_gui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(camera_gui)

root = tk.Tk()
root.withdraw()
status = tk.StringVar(value='idle')
button = tk.Button(root)
helper = Path('/fake/calibreer-cameras')
with patch.object(camera_gui, 'helper_path', return_value=helper), \
     patch.object(camera_gui.shutil, 'which', return_value='/usr/bin/pkexec'), \
     patch.object(camera_gui.messagebox, 'askyesno', return_value=True), \
     patch.object(camera_gui.messagebox, 'showinfo') as info, \
     patch.object(camera_gui.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout='ok', stderr='')) as execute:
    camera_gui.calibrate(root, status, button)
    assert execute.call_args.args[0][0] == 'pkexec'
    assert '--yes' in execute.call_args.args[0]
    assert '--user' in execute.call_args.args[0]
    assert 'Kalibratie gestart' in status.get()
    info.assert_called_once()
root.destroy()
print('PASS camera calibration desktop launcher')
