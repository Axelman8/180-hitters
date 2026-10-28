import importlib.util
import io
from pathlib import Path
from unittest.mock import patch
import urllib.error


path = Path(__file__).parents[1] / 'calibreer-cameras.py'
spec = importlib.util.spec_from_file_location('camera_calibrator', path)
calibrator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(calibrator)


def camera(native, location):
    return dict(native=native, vid='0bdc', pid='8088', serial='same', location=location)


def test_replace_and_parse_devices():
    source = """[api]\nport = 3180\n\n[cam]\ndevices = [\n 'native=/dev/video0&vid=old&pid=old&serial=x&location=1-1',\n]\nfps = 30\n\n[upstream]\nboard_id = 'x'\n"""
    current = [camera('/dev/video0', '1-2'), camera('/dev/video2', '1-3'), camera('/dev/video4', '1-4')]
    updated = calibrator.replace_devices(source, current)
    parsed = calibrator.configured_devices(updated)
    assert [item['native'] for item in parsed] == ['/dev/video0', '/dev/video2', '/dev/video4']
    assert [item['location'] for item in parsed] == ['1-2', '1-3', '1-4']
    assert "[upstream]" in updated


def test_map_slots_prefers_native_then_old_port():
    old = [camera('/dev/video0', '1-1'), camera('/dev/video2', '1-3'), camera('/dev/video4', '1-4')]
    current = [camera('/dev/video6', '1-4'), camera('/dev/video0', '1-2'), camera('/dev/video8', '1-3')]
    mapped = calibrator.map_slots(old, current)
    assert [item['native'] for item in mapped] == ['/dev/video0', '/dev/video8', '/dev/video6']


def test_usb_location_supports_hub_paths():
    properties = {'DEVPATH': '/devices/pci/usb1/1-2/1-2.3/1-2.3:1.0/video4linux/video0'}
    assert calibrator.usb_location(properties) == '1-2.3'


def test_calibration_uses_bodyless_post():
    seen = []
    class Response:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
    def open_request(request, timeout):
        seen.append(request)
        return Response()
    with patch.object(calibrator.urllib.request, 'urlopen', side_effect=open_request):
        calibrator.start_calibration()
    assert seen[0].method == 'POST'
    assert seen[0].data is None
    assert seen[0].get_header('Content-type') is None


def test_calibration_retries_transient_400():
    calls = []
    class Response:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
    def open_request(request, timeout):
        calls.append(request)
        if len(calls) == 1:
            raise urllib.error.HTTPError(request.full_url, 400, 'not ready', {}, io.BytesIO(b''))
        return Response()
    with patch.object(calibrator.urllib.request, 'urlopen', side_effect=open_request), \
         patch.object(calibrator.time, 'sleep'):
        calibrator.start_calibration(attempts=2)
    assert len(calls) == 2


if __name__ == '__main__':
    test_replace_and_parse_devices()
    test_map_slots_prefers_native_then_old_port()
    test_usb_location_supports_hub_paths()
    test_calibration_uses_bodyless_post()
    test_calibration_retries_transient_400()
    print('camera calibrator tests: OK')
