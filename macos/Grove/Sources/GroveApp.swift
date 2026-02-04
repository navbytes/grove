import SwiftUI
import GroveCore

@main
struct GroveApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        // Menu bar app
        MenuBarExtra {
            MenuBarView()
                .environmentObject(appState)
        } label: {
            Image(systemName: "leaf.fill")
        }
        .menuBarExtraStyle(.window)

        // Settings window
        Settings {
            SettingsView()
                .environmentObject(appState)
        }

        // Dashboard window (can be opened from menu bar)
        Window("Grove Dashboard", id: "dashboard") {
            DashboardView()
                .environmentObject(appState)
                .frame(minWidth: 600, minHeight: 400)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 800, height: 600)
    }
}
