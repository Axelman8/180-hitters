import importlib.util
from pathlib import Path


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


if __name__ == '__main__':
    test_replace_and_parse_devices()
    test_map_slots_prefers_native_then_old_port()
    test_usb_location_supports_hub_paths()
    print('camera calibrator tests: OK')
