"""Run on Linux: python3 -m unittest discover -s tests -p 'test_network_control.py'."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('network_control', Path(__file__).parents[1] / 'network-control.py')
network = importlib.util.module_from_spec(spec)
spec.loader.exec_module(network)
WIFI = '6b353061-26e8-4ef6-8495-5bdba53952ab'
HOTSPOT = '9170a69d-e425-4d58-900e-6bbc1def762b'
OTHER = 'd3225be7-81f7-4899-bea2-dcf3ac5ecf50'
DATA = {'hotspot': HOTSPOT, 'profiles': [{'uuid': WIFI}, {'uuid': HOTSPOT}, {'uuid': OTHER}]}


class NetworkTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = patch.object(network, 'STATE', Path(self.temp.name) / 'state.json')
        self.state.start()
        self.addCleanup(self.state.stop)

    def test_success_does_not_activate_fallback(self):
        with patch.object(network, 'active_ids', return_value=[WIFI]), patch.object(network, 'activate', return_value=True) as activate:
            self.assertEqual(network.apply(HOTSPOT, DATA)['phase'], 'done')
            activate.assert_called_once_with(HOTSPOT)

    def test_failed_wifi_restores_hotspot(self):
        with patch.object(network, 'active_ids', return_value=[WIFI]), patch.object(network, 'activate', side_effect=[False, True]) as activate:
            result = network.apply(OTHER, DATA)
            self.assertEqual(result['phase'], 'fallback')
            self.assertEqual([c.args[0] for c in activate.call_args_list], [OTHER, HOTSPOT])
            self.assertEqual(network.state()['target'], HOTSPOT)

    def test_failed_hotspot_restores_previous_wifi(self):
        with patch.object(network, 'active_ids', return_value=[WIFI]), patch.object(network, 'activate', side_effect=[False, False, True]) as activate:
            result = network.apply(OTHER, DATA)
            self.assertEqual(result['target'], WIFI)
            self.assertEqual([c.args[0] for c in activate.call_args_list], [OTHER, HOTSPOT, WIFI])

    def test_total_failure_reported(self):
        with patch.object(network, 'active_ids', return_value=[]), patch.object(network, 'activate', return_value=False):
            self.assertEqual(network.apply(OTHER, DATA)['phase'], 'error')

    def test_already_connected_does_not_restart_network(self):
        with patch.object(network, 'service_busy', return_value=False), patch.object(network, 'active_ids', return_value=[WIFI]), patch.object(network, 'run') as run:
            self.assertEqual(network.request_switch(WIFI, DATA)['phase'], 'done')
            run.assert_not_called()

    def test_concurrent_switch_rejected(self):
        with patch.object(network, 'service_busy', return_value=True), patch.object(network, 'run') as run:
            with self.assertRaises(RuntimeError): network.request_switch(WIFI, DATA)
            run.assert_not_called()

    def test_unknown_target_cannot_run_command(self):
        with patch.object(network.os, 'geteuid', return_value=0), patch.object(network, 'config', return_value=DATA), patch.object(network.sys, 'argv', ['helper', 'switch', 'not-allowed; reboot']), patch.object(network, 'run') as run:
            with self.assertRaises(ValueError): network.main()
            run.assert_not_called()

    def test_activation_timeout_is_failure(self):
        with patch.object(network, 'run', side_effect=network.subprocess.TimeoutExpired('nmcli', 42)):
            self.assertFalse(network.activate(WIFI))


if __name__ == '__main__':
    unittest.main()
