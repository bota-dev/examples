# Third-party notices

The unmodified `gradlew`, `gradlew.bat` and `gradle/wrapper/gradle-wrapper.jar`
come from **Gradle 8.13**, licensed under Apache License 2.0. Launcher copyright
and license headers are retained. The JAR also contains `META-INF/LICENSE`.
Its SHA-256 matches Gradle's [official wrapper checksum](https://services.gradle.org/distributions/gradle-8.13-wrapper.jar.sha256):
`81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f`.

The wrapper downloads the public
[Gradle 8.13 binary distribution](https://services.gradle.org/distributions/gradle-8.13-bin.zip)
using the distribution SHA-256 in its properties. The exact distribution
[LICENSE](gradle/wrapper/LICENSE-GRADLE) and [NOTICE](gradle/wrapper/NOTICE-GRADLE)
are retained here from that checksummed installation. Their broader notices
describe the Gradle build-tool distribution, not libraries shipped in this app's
APK. Build tools are separate from the app/test license gate.

Public application/test dependencies and their reviewed POM licenses, inherited
license sources and binary hashes are listed in
[dependency-provenance.json](dependency-provenance.json). The exact Apache-2.0
license and unmodified HttpCore NOTICE also ship in
`app/src/main/assets/third-party/`. The gate checks actual bundled license/notice
identities and refuses nested archives or public-suffix data. POM labels alone
are insufficient. No OkHttp/PSL or Ktor dependency is shipped.
