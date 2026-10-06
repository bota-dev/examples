package dev.bota.examples.catalog

import dev.bota.sdk.EncryptedUploadV2Recording
import dev.bota.sdk.PendingRecording
import dev.bota.sdk.model.*
import java.time.Instant
import org.junit.Assert.*
import org.junit.Test
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import kotlinx.coroutines.flow.flow

class CatalogStateTest {
    private fun settings() = DeviceConnectionSettings(
        enabledConnections = DeviceConnectionSettings.EnabledConnections(false, true),
        heartbeatEnabledConnections = DeviceConnectionSettings.EnabledConnections(true, false),
        heartbeatUnknownMask = 128u,
        uploadNetworkPreference = listOf(DeviceConnectionSettings.ConnectionType.Cellular,
            DeviceConnectionSettings.ConnectionType.Unknown(9u), DeviceConnectionSettings.ConnectionType.Ble),
        powerManagement = DeviceConnectionSettings.PowerManagement(180, 240),
        streamingEnabled = false, streamingFlushIntervalSeconds = 60,
    )

    @Test fun settingsReadRequiresFreshPairingAndPreservesIndependentMasks() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        var reads = 0
        readConnectionSettings(state) { reads++; settings() }
        assertEquals(0, reads)
        state.pairingResult(state.revision, PairingState.Paired)
        readConnectionSettings(state) { reads++; settings() }
        assertEquals(1, reads)
        assertTrue(state.text.contains("Physical WiFi enabled: false"))
        assertTrue(state.text.contains("Physical cellular enabled: true"))
        assertTrue(state.text.contains("Heartbeat WiFi enabled: true"))
        assertTrue(state.text.contains("Heartbeat cellular enabled: false"))
        assertTrue(state.text.contains("Unknown heartbeat bits: 0x80"))
        assertTrue(state.text.contains("Cellular > Unknown(9) > BLE"))
        assertTrue(state.text.contains("Cellular idle timeout: 240 s"))
    }

    @Test fun settingsFailureNeverDisplaysDefaultOrPreviouslyReadSettings() = runBlocking {
        val state = CatalogState().apply {
            select("EXPECTED"); connectionChanged(device()); pairingResult(revision, PairingState.Paired)
        }
        readConnectionSettings(state) { settings() }
        readConnectionSettings(state) { error("sensitive transport details") }
        assertTrue(state.text.contains("Connection settings unavailable"))
        assertFalse(state.text.contains("enabled:"))
        assertFalse(state.text.contains("sensitive"))
    }

    @Test fun settingsReplyCannotOverwriteReplacementConnection() = runBlocking {
        val state = CatalogState().apply {
            select("EXPECTED"); connectionChanged(device()); pairingResult(revision, PairingState.Paired)
        }
        readConnectionSettings(state) {
            state.connectionChanged(null)
            state.connectionChanged(device())
            settings()
        }
        assertNull(state.device)
        assertTrue(state.text.contains("Checking fresh"))
        state.pairingResult(state.revision, PairingState.Paired)
        readConnectionSettings(state) {
            state.connectionChanged(null)
            error("late read failure")
        }
        assertTrue(state.text.startsWith("Disconnected"))
    }

    @Test fun logsArePairedGatedBoundedAndKeepBacklogSeparate() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        var collections = 0
        val lines = flow {
            collections++
            emit(DeviceLogLine("retained firmware uptime", true))
            emit(DeviceLogLine("fresh firmware uptime", false))
            repeat(100) { emit(DeviceLogLine("x".repeat(1000), false)) }
        }
        readDeviceLogs(state) { lines }
        assertEquals(0, collections)
        state.pairingResult(state.revision, PairingState.Paired)
        readDeviceLogs(state) { lines }
        assertEquals(1, collections)
        assertTrue(state.text.contains("[backlog] retained firmware uptime"))
        assertTrue(state.text.contains("[live] fresh firmware uptime"))
        assertTrue(state.text.contains("Capture limit reached"))
        assertTrue(state.text.length < 17000)
    }

    @Test fun firmwareBacklogFitsWithDisplayLabelsBeforeTheCaptureLimit() = runBlocking {
        val state = CatalogState().apply {
            select("EXPECTED"); connectionChanged(device()); pairingResult(revision, PairingState.Paired)
        }
        // An 8 KiB retained ring can contain more than 200 short lines.
        readDeviceLogs(state) { flow {
            repeat(250) { emit(DeviceLogLine("x".repeat(31), true)) }
            emit(DeviceLogLine("last retained network diagnostic", true))
        } }
        assertTrue(state.text.contains("251 line(s)"))
        assertTrue(state.text.contains("last retained network diagnostic"))
        assertFalse(state.text.contains("Capture limit reached"))
    }

    @Test fun logsFailureAndConnectionLossNeverBecomeEmptySuccess() = runBlocking {
        val state = CatalogState().apply {
            select("EXPECTED"); connectionChanged(device()); pairingResult(revision, PairingState.Paired)
        }
        readDeviceLogs(state) { flow { error("sensitive failure") } }
        assertTrue(state.text.contains("Device logs unavailable"))
        assertFalse(state.text.contains("sensitive"))
        readDeviceLogs(state) { flow {
            state.connectionChanged(null)
            emit(DeviceLogLine("late", true))
        } }
        assertTrue(state.text.startsWith("Disconnected"))
    }

    private fun device(serial: String = "EXPECTED") = ConnectedDevice(
        id = "transport", serialNumber = serial, deviceType = DeviceType.BotaPin,
        firmwareVersion = "test", isProvisioned = false,
        connectionState = ConnectionState.Connected, mtu = 247,
    )

    @Test fun exactSerialGateDoesNotTrustSnapshotProvisioning() {
        val state = CatalogState()
        state.select(" EXPECTED ")
        state.connectionChanged(device("expected"))
        assertNull(state.device)
        assertTrue(state.text.contains("Identity mismatch"))
        state.connectionChanged(device())
        assertNull(state.device)
        state.pairingResult(state.revision, PairingState.Paired)
        assertEquals("EXPECTED", state.device?.serialNumber)
    }

    @Test fun freshPairedReadEnablesMetadataDespiteFalseSnapshot() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        var reads = 0
        checkPairing(state, read = { reads++; assertFalse(it.isProvisioned); PairingState.Paired },
            disconnect = { fail("Paired device must remain connected") })
        assertEquals(1, reads)
        assertNotNull(state.device)
    }

    @Test fun freshUnpairedReadDisconnectsAndDeniesMetadata() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        var disconnects = 0
        checkPairing(state, read = { PairingState.Unpaired }, disconnect = {
            disconnects++
            state.connectionChanged(null)
        })
        assertEquals(1, disconnects)
        assertNull(state.device)
        assertTrue(state.text.contains("Unpaired"))
    }

    @Test fun lostConnectionDuringProbeCannotEnableOrDisconnectReplacement() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        val started = CompletableDeferred<Unit>()
        val response = CompletableDeferred<PairingState>()
        val checking = launch {
            checkPairing(state, read = { started.complete(Unit); response.await() },
                disconnect = { fail("Old probe must not disconnect replacement") })
        }
        started.await()
        state.connectionChanged(null)
        state.connectionChanged(device())
        response.complete(PairingState.Paired)
        checking.join()
        assertNull(state.device)
        assertTrue(state.text.contains("Checking fresh"))
    }

    @Test fun failedFreshReadDeniesAndDisconnects() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        var disconnects = 0
        checkPairing(state, read = { error("transport failure") }, disconnect = { disconnects++ })
        assertEquals(1, disconnects)
        assertNull(state.device)
        assertTrue(state.text.contains("could not be verified"))
    }

    @Test fun connectedNotificationWaitsForConnectCompletionBeforeFreshRead() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        val finished = CompletableDeferred<Unit>()
        var reads = 0
        val checking = launch {
            checkPairing(state, read = { reads++; PairingState.Paired },
                disconnect = { fail("No disconnect expected") }, connectionFinished = finished)
        }
        yield()
        assertEquals(0, reads)
        assertNull(state.device)
        finished.complete(Unit)
        checking.join()
        assertEquals(1, reads)
        assertNotNull(state.device)
    }

    @Test fun lossWhileWaitingForConnectCompletionPreventsFreshRead() = runBlocking {
        val state = CatalogState().apply { select("EXPECTED"); connectionChanged(device()) }
        val finished = CompletableDeferred<Unit>()
        val checking = launch {
            checkPairing(state, read = { fail("Old connection must not be read"); PairingState.Paired },
                disconnect = { fail("No disconnect of replacement") }, connectionFinished = finished)
        }
        yield()
        state.connectionChanged(null)
        state.connectionChanged(device())
        finished.complete(Unit)
        checking.join()
        assertNull(state.device)
    }

    @Test fun emptySerialCannotStartSelection() {
        val state = CatalogState()
        assertThrows(IllegalArgumentException::class.java) { state.select("  ") }
        assertNull(state.device)
    }

    @Test fun lateCatalogOrErrorCannotOverwriteLossOrReplacement() {
        val state = CatalogState()
        state.select("EXPECTED")
        state.connectionChanged(device())
        state.pairingResult(state.revision, PairingState.Paired)
        val token = state.revision
        state.connectionChanged(null)
        state.catalog(token, emptyList())
        state.display(token, "late failure")
        assertTrue(state.text.startsWith("Disconnected"))
        state.connectionChanged(device())
        state.catalog(token, emptyList())
        assertTrue(state.text.startsWith("Verified serial"))
        state.pairingResult(state.revision, PairingState.Paired)
        state.catalog(state.revision, emptyList())
        assertEquals("No pending recordings reported by the device.", state.text)
    }

    @Test fun profilesStayDistinctAndLegacyEncryptionIsNotLost() {
        val legacy = PendingRecording.Legacy(DeviceRecording(
            "legacy-id", Instant.EPOCH, 5uL, 6uL, WireValue.Unknown(99uL), true,
        ))
        val encrypted = PendingRecording.EncryptedV2(EncryptedUploadV2Recording(
            uuid = "v2-id", generation = 7u, ciphertextLength = 123uL,
            ciphertextSha256 = byteArrayOf(0, 0x80.toByte(), 0xff.toByte()),
            durationMs = 42uL, plaintextLength = 100uL,
        ))
        val text = formatCatalog(listOf(legacy, encrypted))
        assertTrue(text.contains("2 pending recording(s)"))
        assertTrue(text.contains("Legacy catalog profile"))
        assertTrue(text.contains("Encrypted flag: true"))
        assertTrue(text.contains("Encrypted-v2 catalog profile"))
        assertTrue(text.contains("Generation: 7"))
        assertTrue(text.contains("Ciphertext length: 123 bytes"))
        assertTrue(text.contains("Ciphertext SHA-256: 0080ff"))
    }
}
