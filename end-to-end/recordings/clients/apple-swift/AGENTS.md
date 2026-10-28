# Swift recordings client

- Follow the [repository instructions](../../../../AGENTS.md), [design](../../../../DESIGN.md), [shared read contract](../../contracts/native-library-read.md) and this [README](README.md).
- This copyable root targets iOS 15/macOS 13 with Swift 6 and Apple system frameworks only. It contains no Bota device SDK or private app dependency. Keep Sample mode local and visibly synthetic.
- Commands on macOS/Xcode 26.3: `node --test scripts/check-dependencies.test.mjs`, `node scripts/check-dependencies.mjs`, `swift test`, `bash build.sh`, `bash build-ios.sh`. Node is 22.23.2; CI owns its exact toolchain and action pins.
- Preserve the four fixed GETs, first-page limit, UTF-16 DTO caps, exact source joins, in-memory application token and bounded streaming transport. Bota keys remain on the backend. No retries, processing writes, audio or device controls in this slice.
- Clear content on replacement/sign-out/inactive window; cancel and join readers before replacement. Cleanup failure closes admission. Keep tests synthetic or loopback-only, and report native builds, live API reads and physical acceptance separately.
- New dependencies fail the zero-third-party license gate and require an explicit policy/security review. Do not bypass it with vendored binaries or another example's runtime imports. Include the actual agent model's commit attribution.
