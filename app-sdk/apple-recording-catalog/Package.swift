// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BotaCatalog",
    platforms: [.macOS(.v13)],
    dependencies: [.package(url: "https://github.com/bota-dev/app-sdk.git", exact: "2.0.0-beta.13")],
    targets: [.executableTarget(name: "BotaCatalog", dependencies: [
        .product(name: "BotaAppSDK", package: "app-sdk")
    ])]
)
