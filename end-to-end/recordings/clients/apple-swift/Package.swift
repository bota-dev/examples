// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BotaRecordings",
    platforms: [.macOS(.v13)],
    dependencies: [],
    targets: [
        .executableTarget(name: "BotaRecordings"),
        .testTarget(name: "BotaRecordingsTests", dependencies: ["BotaRecordings"]),
    ]
)
