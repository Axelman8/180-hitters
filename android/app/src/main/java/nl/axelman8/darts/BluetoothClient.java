package nl.axelman8.darts;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

final class BluetoothClient {
    static final UUID SERVICE_UUID = UUID.fromString("7a715e67-0d7a-4f89-b0d7-47a16d455501");
    private static final String CLIENT_TOKEN = "d7c87006c31f4da2a4348eeb05b59c8b";
    private final BluetoothAdapter adapter;
    private final AtomicLong sequence = new AtomicLong();
    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor();
    private String address;
    private volatile BluetoothSocket socket;
    private volatile BufferedReader input;
    private volatile BufferedWriter output;
    private long lastFailure;

    static final class Result {
        final int status;
        final String body;
        Result(int status, String body) { this.status = status; this.body = body; }
    }

    BluetoothClient() { adapter = BluetoothAdapter.getDefaultAdapter(); }

    boolean isAvailable() { return adapter != null; }

    @SuppressLint("MissingPermission")
    List<BluetoothDevice> pairedDevices() {
        List<BluetoothDevice> devices = new ArrayList<>();
        if (adapter != null) devices.addAll(adapter.getBondedDevices());
        devices.sort(Comparator.comparing(d -> {
            String name = d.getName();
            return name == null ? d.getAddress() : name.toLowerCase();
        }));
        return devices;
    }

    synchronized void select(String deviceAddress) {
        if (!deviceAddress.equals(address)) closeSocket();
        address = deviceAddress;
    }

    synchronized String selectedAddress() { return address; }

    @SuppressLint("MissingPermission")
    synchronized Result request(String method, String path, String body) throws Exception {
        if (System.currentTimeMillis() - lastFailure < 2000)
            throw new IllegalStateException("Bluetooth probeert opnieuw te verbinden");
        ensureConnected();
        JSONObject message = new JSONObject()
                .put("id", sequence.incrementAndGet())
                .put("clientToken", CLIENT_TOKEN)
                .put("method", method)
                .put("path", path);
        if (body != null && !body.isEmpty()) message.put("body", new JSONObject(body));
        BufferedWriter currentOutput = output;
        BufferedReader currentInput = input;
        ScheduledFuture<?> timeout = watchdog.schedule(() -> {
            Log.w("180HittersBluetooth", "Bluetooth-verzoek duurde te lang; verbinding wordt hersteld");
            closeSocket();
        }, 15, TimeUnit.SECONDS);
        try {
            currentOutput.write(message.toString());
            currentOutput.write('\n');
            currentOutput.flush();
            String line = currentInput.readLine();
            if (line == null) throw new IllegalStateException("Bluetooth-verbinding verbroken");
            JSONObject response = new JSONObject(line);
            Object responseBody = response.opt("body");
            String encoded = responseBody == null || responseBody == JSONObject.NULL ? "{}" :
                    (responseBody instanceof String ? (String) responseBody : responseBody.toString());
            return new Result(response.optInt("status", 502), encoded);
        } catch (Exception error) {
            lastFailure = System.currentTimeMillis();
            closeSocket();
            throw error;
        } finally { timeout.cancel(false); }
    }

    @SuppressLint("MissingPermission")
    private void ensureConnected() throws Exception {
        if (socket != null && socket.isConnected()) return;
        if (adapter == null || !adapter.isEnabled()) throw new IllegalStateException("Bluetooth staat uit");
        if (address == null) throw new IllegalStateException("Geen NUC gekozen");
        adapter.cancelDiscovery();
        BluetoothDevice device = adapter.getRemoteDevice(address);
        BluetoothSocket candidate = device.createRfcommSocketToServiceRecord(SERVICE_UUID);
        ScheduledFuture<?> connectTimeout = watchdog.schedule(() -> {
            try { candidate.close(); } catch (Exception ignored) {}
        }, 10, TimeUnit.SECONDS);
        try {
            candidate.connect();
            socket = candidate;
            input = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            output = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
            Log.i("180HittersBluetooth", "Verbonden met " + device.getName());
        } catch (Exception error) {
            try { candidate.close(); } catch (Exception ignored) {}
            lastFailure = System.currentTimeMillis();
            throw error;
        } finally { connectTimeout.cancel(false); }
    }

    void closeSocket() {
        BluetoothSocket current = socket;
        socket = null; input = null; output = null;
        try { if (current != null) current.close(); } catch (Exception ignored) {}
    }

    void shutdown() { closeSocket(); watchdog.shutdownNow(); }
}
