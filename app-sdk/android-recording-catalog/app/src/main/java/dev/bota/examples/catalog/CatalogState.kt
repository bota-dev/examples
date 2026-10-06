package dev.bota.examples.catalog

import dev.bota.sdk.PendingRecording
import dev.bota.sdk.model.ConnectedDevice
import dev.bota.sdk.model.PairingState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.Deferred
import dev.bota.sdk.model.DeviceConnectionSettings
import dev.bota.sdk.model.DeviceLogLine
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.takeWhile
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant

/** Activity-local display state. A newer connection event invalidates older read results. */
internal class CatalogState {
    var expectedSerial = ""
        private set
    var device: ConnectedDevice? = null
        private set
    var connection: ConnectedDevice? = null
        private set
    private var rejection: String? = null
    var revision = 0L
        private set
    var text = "Enable Bluetooth access. Metadata only; no audio transfer."
        private set

    fun select(serial: String) {
        require(serial.trim().isNotEmpty()) { "Enter the exact printed serial." }
        expectedSerial = serial.trim()
        rejection = null
        connectionChanged(null)
        text = "Connecting and verifying the selected device…"
    }

    fun connectionChanged(value: ConnectedDevice?) {
        revision++
        device = null
        connection = value?.takeIf { it.serialNumber == expectedSerial }
        text = when {
            value == null -> rejection ?: "Disconnected. Restore Bluetooth, scan, and reconnect explicitly."
            value.serialNumber != expectedSerial -> "Identity mismatch. No catalog read is allowed."
            else -> "Verified serial: ${value.serialNumber}\nChecking fresh device pairing state…"
        }
    }

    fun pairingResult(token: Long, paired: PairingState): Boolean {
        if (token != revision || connection == null) return false
        if (paired != PairingState.Paired) return reject(token,
            "Device pairing state is $paired. Metadata reads denied; disconnecting. This does not establish a factory-clean device.")
        device = connection
        text = "Verified serial: ${device!!.serialNumber}\nFirmware: ${device!!.firmwareVersion}\nFresh pairing state: Paired. Ready to read metadata."
        return false
    }

    fun reject(token: Long, reason: String): Boolean {
        if (token != revision || connection == null) return false
        device = null
        rejection = reason
        text = reason
        return true
    }

    fun display(token: Long, value: String) {
        if (token == revision) text = value
    }

    fun catalog(token: Long, rows: List<PendingRecording>) {
        if (device != null) display(token, formatCatalog(rows))
    }
}

/** Called only from a connection notification; connect completion never enables reads. */
internal suspend fun checkPairing(
    state: CatalogState,
    read: suspend (ConnectedDevice) -> PairingState,
    disconnect: suspend () -> Unit,
    connectionFinished: Deferred<Unit>? = null,
) {
    val device = state.connection ?: return
    val token = state.revision
    // The SDK emits its connected event before releasing the connect operation.
    connectionFinished?.await()
    if (token != state.revision) return
    val denied = try {
        state.pairingResult(token, read(device))
    } catch (_: TimeoutCancellationException) {
        state.reject(token, "Pairing-state read timed out. Metadata reads denied; disconnecting.")
    } catch (cancelled: CancellationException) { throw cancelled }
    catch (_: Exception) {
        state.reject(token, "Pairing state could not be verified. Metadata reads denied; disconnecting.")
    }
    if (denied) disconnect()
}

internal fun formatCatalog(rows: List<PendingRecording>): String {
    if (rows.isEmpty()) return "No pending recordings reported by the device."
    return "${rows.size} pending recording(s) — metadata only\n\n" + rows.joinToString("\n\n") { item ->
        when (item) {
            is PendingRecording.Legacy -> with(item.recording) {
                "Legacy catalog profile\nUUID/legacy identifier: $uuid\n" +
                    "Started (UTC): $startedAt\nDuration: $durationMs ms\n" +
                    "File length: $fileSizeBytes bytes\nEncrypted flag: $isEncrypted\n" +
                    "Legacy does not imply plaintext or encrypted-v2 support."
            }
            is PendingRecording.EncryptedV2 -> with(item.recording) {
                "Encrypted-v2 catalog profile\nUUID: $uuid\nGeneration: $generation\n" +
                    "Started (Unix ms, as reported): $startedAtMs\nDuration: $durationMs ms\n" +
                    "Ciphertext length: $ciphertextLength bytes\nPlaintext length: $plaintextLength bytes\n" +
                    "Storage format: $storageFormat\nCiphertext SHA-256: " +
                    ciphertextSha256.joinToString("") { "%02x".format(it.toInt() and 0xff) }
            }
        }
    }
}

internal suspend fun readConnectionSettings(
    state: CatalogState,
    read: suspend (ConnectedDevice) -> DeviceConnectionSettings,
) {
    val device = state.device ?: return
    val token = state.revision
    state.display(token, "Reading device connection settings…")
    try {
        val value = withTimeout(30_000) { read(device) }
        state.display(token, formatConnectionSettings(value))
    } catch (_: TimeoutCancellationException) {
        state.display(token, "Connection settings unavailable: read timed out. No defaults shown.")
    } catch (cancelled: CancellationException) { throw cancelled }
    catch (_: Exception) {
        state.display(token, "Connection settings unavailable: read failed. No defaults shown.")
    }
}

internal fun formatConnectionSettings(value: DeviceConnectionSettings): String = with(value) {
    "Device connection settings (SDK read; no settings written)\n" +
        "Physical WiFi enabled: ${enabledConnections.wifi}\n" +
        "Physical cellular enabled: ${enabledConnections.cellular}\n" +
        "Heartbeat WiFi enabled: ${heartbeatEnabledConnections.wifi}\n" +
        "Heartbeat cellular enabled: ${heartbeatEnabledConnections.cellular}\n" +
        "Unknown heartbeat bits: 0x${heartbeatUnknownMask.toString(16).padStart(2, '0')}\n" +
        "Upload priority: ${uploadNetworkPreference.joinToString(" > ") { when (it) {
            DeviceConnectionSettings.ConnectionType.Wifi -> "WiFi"
            DeviceConnectionSettings.ConnectionType.Cellular -> "Cellular"
            DeviceConnectionSettings.ConnectionType.Ble -> "BLE"
            is DeviceConnectionSettings.ConnectionType.Unknown -> "Unknown(${it.rawValue})"
        } }}\n" +
        "WiFi idle timeout: ${powerManagement.wifiIdleTimeoutSeconds} s\n" +
        "Cellular idle timeout: ${powerManagement.cellularIdleTimeoutSeconds} s\n" +
        "Streaming enabled: $streamingEnabled\n" +
        "Streaming flush interval: $streamingFlushIntervalSeconds s\n" +
        "Policy is not evidence of an active connection or a received heartbeat."
}

internal suspend fun readDeviceLogs(
    state: CatalogState,
    read: (ConnectedDevice) -> Flow<DeviceLogLine>,
) {
    val device = state.device ?: return
    val token = state.revision
    val started = Instant.now()
    val lines = StringBuilder()
    var bytes = 0
    var count = 0
    var limited = false
    state.display(token, "Reading firmware logs for up to 15 seconds…")
    try {
        withTimeoutOrNull(15_000) {
            read(device).takeWhile { line ->
                val formatted = "[${if (line.isBacklog) "backlog" else "live"}] ${line.message}\n"
                val size = formatted.toByteArray(Charsets.UTF_8).size
                limited = count >= 200 || size > 8192 - bytes
                if (limited || token != state.revision) false else {
                    lines.append(formatted)
                    bytes += size
                    count++
                    true
                }
            }.collect { }
        }
        state.display(token, "Firmware log capture: $count line(s), $bytes displayed UTF-8 bytes\n" +
            "Host observation (UTC): $started to ${Instant.now()}\n" +
            "Backlog/live flags are from the SDK; firmware timestamps remain unchanged.\n" +
            "Host observation time is not firmware event time.\n" +
            (if (limited) "Capture limit reached; later lines omitted.\n" else "") +
            (if (lines.isEmpty()) "No log lines observed; this does not prove device inactivity."
                else lines.toString()))
    } catch (cancelled: CancellationException) { throw cancelled }
    catch (_: Exception) {
        state.display(token, "Device logs unavailable: read or stream cleanup failed. No complete capture shown.")
    }
}
