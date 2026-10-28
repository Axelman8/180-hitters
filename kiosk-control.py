#!/usr/bin/env python3
"""Compatibility entry point; the updater always replaces the complete dist."""
from pathlib import Path
import runpy


runpy.run_path(str(Path(__file__).resolve().parent / 'dist' / 'kiosk-control.py'), run_name='__main__')
