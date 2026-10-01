// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BotaConnect",
    platforms: [.macOS(.v13)],
    dependencies: [.package(url: "https://github.com/bota-dev/app-sdk.git", exact: "2.0.0-beta.10")],
    targets: [.executableTarget(name: "BotaConnect", dependencies: [
        .product(name: "BotaAppSDK", package: "app-sdk")
    ])]
)
