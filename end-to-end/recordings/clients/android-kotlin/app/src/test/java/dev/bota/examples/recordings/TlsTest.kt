package dev.bota.examples.recordings

import org.testng.annotations.Test

class TlsTest {
    @Test fun systemTrustAndHttpsEndpointVerificationStayEnabled() = TlsChecks.verifyDefaultTrustAndEndpointChecks()
}
