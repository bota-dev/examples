package dev.bota.examples.catalog

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.*
import dev.bota.sdk.BotaConfiguration
import dev.bota.sdk.BotaDeviceClient
import kotlinx.coroutines.*

class MainActivity : Activity() {
    private val client = BotaDeviceClient.shared
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val state = CatalogState()
    private var ready = false
    private var busy = false
    private var pairingCheck: Job? = null
    private var connectionFinished: CompletableDeferred<Unit>? = null
    private lateinit var serial: EditText
    private lateinit var output: TextView
    private lateinit var devices: LinearLayout
    private lateinit var scan: Button
    private lateinit var status: Button
    private lateinit var list: Button
    private lateinit var disconnect: Button
    private val permissions get() = if (Build.VERSION.SDK_INT >= 31)
        arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 64, 32, 32) }
        fun button(title: String, action: () -> Unit) = Button(this).apply {
            text = title; setOnClickListener { action() }; content.addView(this)
        }
        serial = EditText(this).apply { hint = "Exact serial printed on your provisioned device"; setSingleLine() }
        output = TextView(this).apply { setTextIsSelectable(true) }
        devices = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(serial)
        button("Enable Bluetooth access") {
            if (permissions.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) initialize()
            else requestPermissions(permissions, 1)
        }
        scan = button("Scan for 10 seconds") { perform {
            devices.removeAllViews()
            val seen = mutableSetOf<String>()
            client.devices.startScan().collect { candidate ->
                if (seen.add(candidate.id)) devices.addView(Button(this@MainActivity).apply {
                    text = "${candidate.name ?: "Bota device"} · ${candidate.rssi} dBm"
                    setOnClickListener { perform {
                        state.select(serial.text.toString())
                        render()
                        val finished = CompletableDeferred<Unit>()
                        connectionFinished = finished
                        try { client.devices.connect(state.expectedSerial, candidate) }
                        finally { finished.complete(Unit) }
                    } }
                })
            }
            state.display(state.revision, "Scan finished. Select a device to verify its serial.")
        } }
        content.addView(devices)
        status = button("Read status") { perform(preserveConnectionEvents = true) {
            checkNotNull(state.device)
            val token = state.revision
            val value = withTimeout(30_000) { client.devices.readStatus() }
            state.display(token, value.toString())
        } }
        list = button("List recording metadata") { perform(preserveConnectionEvents = true) {
            val device = checkNotNull(state.device)
            val token = state.revision
            val rows = withTimeout(30_000) { client.recordings.listPendingRecordings(device) }
            state.catalog(token, rows)
        } }
        disconnect = button("Disconnect") { perform {
            state.connectionChanged(null)
            devices.removeAllViews()
            render()
            client.devices.disconnect()
        } }
        content.addView(output)
        setContentView(ScrollView(this).apply { addView(content) })
        render()
    }

    private fun initialize() {
        if (ready || busy) return
        busy = true
        render()
        scope.launch {
            try {
                client.configure(BotaConfiguration(applicationContext))
                ready = true
                scope.launch {
                    client.devices.connectionUpdates().collect { device ->
                        pairingCheck?.cancel()
                        state.connectionChanged(device)
                        render()
                        if (state.connection != null) pairingCheck = scope.launch {
                            try {
                                checkPairing(state,
                                    read = { withTimeout(30_000) { client.controls.readPairingState(it) } },
                                    disconnect = { client.devices.disconnect() },
                                    connectionFinished = connectionFinished,
                                )
                            } catch (cancelled: CancellationException) { throw cancelled }
                            catch (_: Exception) {
                                // Reads remain denied if transport cleanup itself fails.
                            } finally { render() }
                        }
                    }
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { state.display(state.revision, "Initialization failed. Check Bluetooth and permissions.") }
            finally { busy = false; render() }
        }
    }

    private fun perform(preserveConnectionEvents: Boolean = false, action: suspend () -> Unit) {
        if (!ready || busy) return
        busy = true
        render()
        val token = state.revision
        scope.launch {
            try { action() }
            catch (_: TimeoutCancellationException) {
                state.display(if (preserveConnectionEvents) token else state.revision, "Read timed out. No audio was transferred. Reconnect explicitly if needed.")
            }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) {
                state.display(if (preserveConnectionEvents) token else state.revision, "Operation failed. Check the exact serial, provisioning, Bluetooth and firmware catalog support. No partial catalog is shown.")
            }
            finally { busy = false; render() }
        }
    }

    private fun render() {
        output.text = state.text
        serial.isEnabled = !busy && state.connection == null
        scan.isEnabled = ready && !busy && state.connection == null
        status.isEnabled = ready && !busy && state.device != null
        list.isEnabled = status.isEnabled
        disconnect.isEnabled = ready && !busy && state.connection != null
        for (index in 0 until devices.childCount) devices.getChildAt(index).isEnabled = scan.isEnabled
    }

    override fun onRequestPermissionsResult(code: Int, names: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, names, results)
        if (code == 1 && results.isNotEmpty() && results.all { it == PackageManager.PERMISSION_GRANTED }) initialize()
        else { state.display(state.revision, "Bluetooth access is required. Grant it in Settings and retry."); render() }
    }

    override fun onDestroy() {
        scope.cancel()
        val sdk = client
        // Cleanup outlives UI work without capturing the Activity.
        CoroutineScope(Dispatchers.Main).launch { sdk.destroy() }
        super.onDestroy()
    }
}
