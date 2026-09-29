package dev.bota.examples.connect

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
    private var busy = false
    private var ready = false
    private lateinit var serial: EditText
    private lateinit var output: TextView
    private lateinit var devices: LinearLayout
    private val permissions get() = if (Build.VERSION.SDK_INT >= 31)
        arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 64, 32, 32) }
        fun button(title: String, action: () -> Unit) { content.addView(Button(this).apply { text = title; setOnClickListener { action() } }) }
        serial = EditText(this).apply { hint = "Exact serial printed on device"; setSingleLine() }
        output = TextView(this).apply { text = "Read-only discovery and status. No API key required."; setTextIsSelectable(true) }
        devices = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(serial)
        button("Enable Bluetooth access") {
            if (permissions.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) initialize()
            else requestPermissions(permissions, 1)
        }
        button("Scan for 10 seconds") { perform {
            devices.removeAllViews()
            val seen = mutableSetOf<String>()
            client.devices.startScan().collect { candidate ->
                if (seen.add(candidate.id)) devices.addView(Button(this@MainActivity).apply {
                    text = "${candidate.name ?: "Bota device"} Â· ${candidate.rssi} dBm"
                    setOnClickListener { perform {
                        val expected = serial.text.toString().trim()
                        require(expected.isNotEmpty())
                        val device = client.devices.connect(expected, candidate)
                        output.text = "Verified serial: ${device.serialNumber}"
                    } }
                })
            }
            output.text = "Scan finished. Select a device."
        } }
        content.addView(devices)
        button("Read status") { perform { output.text = client.devices.readStatus().toString() } }
        button("Disconnect") { perform { client.devices.disconnect(); output.text = "Disconnected." } }
        content.addView(output)
        setContentView(ScrollView(this).apply { addView(content) })
    }

    private fun initialize() {
        if (ready || busy) return
        busy = true
        scope.launch {
            try { client.configure(BotaConfiguration(applicationContext)); ready = true; output.text = "Ready. Enter a serial and scan." }
            catch (_: Exception) { output.text = "Initialization failed. Check Bluetooth and permissions." }
            finally { busy = false }
        }
    }

    override fun onRequestPermissionsResult(code: Int, names: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, names, results)
        if (code == 1 && results.isNotEmpty() && results.all { it == PackageManager.PERMISSION_GRANTED }) initialize()
        else output.text = "Bluetooth access is required. You can grant it in Settings and retry."
    }

    private fun perform(action: suspend () -> Unit) {
        if (!ready || busy) { output.text = "Enable Bluetooth access and wait for the current operation."; return }
        busy = true
        serial.isEnabled = false
        scope.launch {
            try { action() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { output.text = "Operation failed. Check serial, Bluetooth, and device availability." }
            finally { busy = false; serial.isEnabled = true }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        // SDK singleton cleanup outlives the cancelled UI jobs; no Activity captured.
        CoroutineScope(Dispatchers.Main).launch { client.destroy() }
        super.onDestroy()
    }
}

