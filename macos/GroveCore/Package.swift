// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GroveCore",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "GroveCore",
            targets: ["GroveCore"]
        ),
    ],
    targets: [
        .target(
            name: "GroveCore",
            dependencies: []
        ),
        .testTarget(
            name: "GroveCoreTests",
            dependencies: ["GroveCore"]
        ),
    ]
)
