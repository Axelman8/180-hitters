#!/usr/bin/env python3
"""BlueZ RFCOMM bridge from the Android app to the local darts HTTP API."""
import http.client
import json
import os
import socket
import threading

import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

UUID = '7a715e67-0d7a-4f89-b0d7-47a16d455501'
PROFILE_PATH = '/nl/axelman8/darts/profile'
AGENT_PATH = '/nl/axelman8/darts/agent'
TOKEN = os.environ.get('DARTS_CONTROL_TOKEN', '')


def relay(fd):
    connection = socket.socket(fileno=fd)
    stream = connection.makefile('rwb', buffering=0)
    try:
        while True:
            line = stream.readline(10_000_001)
            if not line:
                break
            if len(line) > 10_000_000:
                raise ValueError('Bericht te groot')
            request = json.loads(line)
            method = request.get('method')
            path = request.get('path')
            if method not in ('GET', 'POST') or not isinstance(path, str) or not path.startswith('/api/'):
                raise ValueError('Ongeldig verzoek')
            body = None if method == 'GET' else json.dumps(request.get('body', {}), separators=(',', ':')).encode()
            headers = {'X-Darts-Control': TOKEN}
            if body is not None:
                headers['Content-Type'] = 'application/json'
                headers['Content-Length'] = str(len(body))
            upstream = http.client.HTTPConnection('127.0.0.1', 8765, timeout=12)
            try:
                upstream.request(method, path, body=body, headers=headers)
                response = upstream.getresponse()
                payload = response.read(10_000_001)
                if len(payload) > 10_000_000:
                    raise ValueError('Antwoord te groot')
                try:
                    value = json.loads(payload)
                except (ValueError, UnicodeDecodeError):
                    value = {'error': 'Ongeldig antwoord van de NUC'}
                result = {'id': request.get('id'), 'status': response.status, 'body': value}
            finally:
                upstream.close()
            stream.write((json.dumps(result, separators=(',', ':')) + '\n').encode())
    except Exception as error:
        try:
            stream.write((json.dumps({'status': 502, 'body': {'error': str(error)}}) + '\n').encode())
        except Exception:
            pass
    finally:
        try: stream.close()
        finally: connection.close()


class Profile(dbus.service.Object):
    @dbus.service.method('org.bluez.Profile1', in_signature='', out_signature='')
    def Release(self):
        os._exit(1)

    @dbus.service.method('org.bluez.Profile1', in_signature='oha{sv}', out_signature='')
    def NewConnection(self, device, fd, properties):
        threading.Thread(target=relay, args=(fd.take(),), daemon=True).start()

    @dbus.service.method('org.bluez.Profile1', in_signature='o', out_signature='')
    def RequestDisconnection(self, device):
        pass


class Agent(dbus.service.Object):
    @dbus.service.method('org.bluez.Agent1', in_signature='', out_signature='')
    def Release(self): pass

    @dbus.service.method('org.bluez.Agent1', in_signature='o', out_signature='s')
    def RequestPinCode(self, device): return '0000'

    @dbus.service.method('org.bluez.Agent1', in_signature='ou', out_signature='')
    def RequestConfirmation(self, device, passkey): pass

    @dbus.service.method('org.bluez.Agent1', in_signature='os', out_signature='')
    def AuthorizeService(self, device, service_uuid): pass

    @dbus.service.method('org.bluez.Agent1', in_signature='', out_signature='')
    def Cancel(self): pass


def main():
    DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()
    Profile(bus, PROFILE_PATH)
    Agent(bus, AGENT_PATH)
    objects = dbus.Interface(bus.get_object('org.bluez', '/'), 'org.freedesktop.DBus.ObjectManager').GetManagedObjects()
    adapter_path = next(path for path, interfaces in objects.items() if 'org.bluez.Adapter1' in interfaces)
    properties = dbus.Interface(bus.get_object('org.bluez', adapter_path), 'org.freedesktop.DBus.Properties')
    for name, value in [('Powered', True), ('Pairable', True), ('Discoverable', True)]:
        properties.Set('org.bluez.Adapter1', name, dbus.Boolean(value))
    properties.Set('org.bluez.Adapter1', 'PairableTimeout', dbus.UInt32(0))
    properties.Set('org.bluez.Adapter1', 'DiscoverableTimeout', dbus.UInt32(0))
    manager = dbus.Interface(bus.get_object('org.bluez', '/org/bluez'), 'org.bluez.ProfileManager1')
    manager.RegisterProfile(PROFILE_PATH, UUID, {
        'Name': '180 Hitters', 'Role': 'server', 'RequireAuthentication': True,
        'RequireAuthorization': False, 'AutoConnect': True, 'Channel': dbus.UInt16(23),
    })
    agent_manager = dbus.Interface(bus.get_object('org.bluez', '/org/bluez'), 'org.bluez.AgentManager1')
    try:
        agent_manager.RegisterAgent(AGENT_PATH, 'NoInputNoOutput')
        agent_manager.RequestDefaultAgent(AGENT_PATH)
    except dbus.exceptions.DBusException as error:
        if error.get_dbus_name() != 'org.bluez.Error.AlreadyExists':
            raise
    def owner_changed(name, old_owner, new_owner):
        if name == 'org.bluez' and old_owner and not new_owner:
            os._exit(1)
    bus.add_signal_receiver(owner_changed, signal_name='NameOwnerChanged',
                            dbus_interface='org.freedesktop.DBus', arg0='org.bluez')
    print('180 Hitters Bluetooth bridge actief', flush=True)
    GLib.MainLoop().run()


if __name__ == '__main__':
    main()
