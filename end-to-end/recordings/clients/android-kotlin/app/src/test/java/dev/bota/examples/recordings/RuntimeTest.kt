package dev.bota.examples.recordings

import org.testng.annotations.Test

class RuntimeTest {
    @Test fun authenticatedGetDoesNotReplayAfterEarlyEof() = RuntimeChecks.authenticatedGetAndNoRetry()
    @Test fun revokeJoinsActualReader() = RuntimeChecks.cancellationJoinsActualReader()
    @Test fun cancelledResultDoesNotReleaseBlockedReactor() = RuntimeChecks.cancellationWaitsForRealReactorCallback()
}
