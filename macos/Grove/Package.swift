// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Grove",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [
        .package(path: "../GroveCore")
    ],
    targets: [
        .executableTarget(
            name: "Grove",
            dependencies: ["GroveCore"],
            path: "Sources"
        ),
    ]
)
