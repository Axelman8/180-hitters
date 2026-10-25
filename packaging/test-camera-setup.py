"""Offline wizard checks: never downloads or starts real AutoDarts."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('camera_setup', Path(__file__).with_name('camera-setup.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
with tempfile.TemporaryDirectory() as directory:
    setup.HOME = Path(directory)
    setup.CONFIG = setup.HOME / 'config'
    setup.CONFIG.mkdir()
    setup.APPIMAGE = setup.HOME / 'bin/autodarts-desktop.AppImage'
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        if args[0] == 'curl':
            Path(args[-1]).write_text('#!/bin/bash\n')
        if args[0] == 'bash':
            setup.APPIMAGE.parent.mkdir(exist_ok=True)
            setup.APPIMAGE.touch()
        return SimpleNamespace(returncode=0)
    with patch.object(setup, 'detector', return_value={}), patch.object(setup.subprocess, 'run', side_effect=run):
        setup.install_detector()
        assert any(c[0] == 'bash' and c[-1] == '--desktop' for c in calls)
        assert any('https://autodarts.sh' in c for c in calls)
        count = len(calls)
        setup.install_detector()
        assert len(calls) == count  # no repeated installation
    with patch.object(setup, 'detector', return_value={'running':True}), patch.object(setup.subprocess, 'Popen') as start:
        setup.launch_detector()
        start.assert_not_called()  # no second camera owner
    setup.APPIMAGE.unlink()
    with patch.object(setup, 'detector', return_value={}), patch.object(setup.subprocess, 'run', return_value=SimpleNamespace(returncode=1)):
        try:
            setup.launch_detector()
            raise AssertionError('Missing installation accepted')
        except RuntimeError:
            pass
    # XDG desktop folder may include translated names and spaces.
    desktop = setup.HOME / 'Mijn Bureaublad'
    with patch.object(setup.subprocess, 'run', return_value=SimpleNamespace(returncode=0,stdout=str(desktop))), patch.object(setup.shutil, 'copy2', side_effect=lambda src,dst:dst.write_text('[Desktop Entry]')):
        setup.shortcuts()
        assert (desktop/'dartsapp.desktop').is_file()
        assert (desktop/'dartsapp-camera.desktop').is_file()
        assert (desktop/'dartsapp-display.desktop').is_file()
print('PASS official download flow, repeat install, camera ownership and desktop shortcuts')
