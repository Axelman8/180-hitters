"""Regression check for pausing Android work while 180 Hitters is hidden."""
from pathlib import Path


root = Path(__file__).resolve().parents[1]
activity = (root / 'android/app/src/main/java/nl/axelman8/darts/MainActivity.java').read_text(
    encoding='utf-8'
)

pause_body = activity.split('void onPause(){', 1)[1].split('super.onPause();', 1)[0]
resume_body = activity.split('void onResume(){', 1)[1].split('if(updater!=null)', 1)[0]

assert 'web.onPause();' in pause_body
assert 'web.pauseTimers();' in pause_body
assert 'bluetooth.closeSocket();' in pause_body
assert pause_body.index('web.onPause();') < pause_body.index('web.pauseTimers();')
assert 'web.resumeTimers();' in resume_body
assert 'web.onResume();' in resume_body
assert resume_body.index('web.resumeTimers();') < resume_body.index('web.onResume();')

print('PASS: Android WebView and Bluetooth pause in the background and resume in the foreground')
