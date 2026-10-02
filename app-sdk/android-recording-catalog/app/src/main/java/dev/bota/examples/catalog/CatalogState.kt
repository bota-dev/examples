package dev.bota.examples.catalog

import dev.bota.sdk.PendingRecording
import dev.bota.sdk.model.ConnectedDevice
import dev.bota.sdk.model.PairingState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.Deferred

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
