import SwiftUI
import GroveCore

struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.openWindow) private var openWindow
    @State private var showingNewTask = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "leaf.fill")
                    .foregroundColor(.green)
                Text("Grove")
                    .font(.headline)
                Spacer()
                if appState.isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(NSColor.controlBackgroundColor))

            Divider()

            if !appState.isSetup {
                // Setup prompt
                VStack(spacing: 12) {
                    Image(systemName: "gearshape")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Grove needs to be set up")
                        .font(.subheadline)
                    Button("Open Settings") {
                        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(20)
            } else if appState.activeTasks.isEmpty {
                // Empty state
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No active tasks")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Button("New Task") {
                        showingNewTask = true
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(20)
            } else {
                // Task list
                ScrollView {
                    LazyVStack(spacing: 1) {
                        ForEach(appState.activeTasks.prefix(5)) { task in
                            MenuBarTaskRow(task: task)
                        }
                    }
                }
                .frame(maxHeight: 300)

                if appState.activeTasks.count > 5 {
                    Text("\(appState.activeTasks.count - 5) more tasks...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 8)
                }

                Divider()

                // Actions
                HStack(spacing: 12) {
                    Button {
                        showingNewTask = true
                    } label: {
                        Label("New Task", systemImage: "plus")
                    }
                    .buttonStyle(.borderless)

                    Spacer()

                    Button {
                        openWindow(id: "dashboard")
                    } label: {
                        Label("Dashboard", systemImage: "rectangle.grid.1x2")
                    }
                    .buttonStyle(.borderless)
                }
                .padding(12)
            }

            Divider()

            // Footer actions
            HStack {
                Button {
                    Task {
                        await appState.refresh()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .help("Refresh")

                Spacer()

                Button {
                    NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
                } label: {
                    Image(systemName: "gearshape")
                }
                .buttonStyle(.borderless)
                .help("Settings")

                Button {
                    NSApplication.shared.terminate(nil)
                } label: {
                    Image(systemName: "power")
                }
                .buttonStyle(.borderless)
                .help("Quit")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
        }
        .frame(width: 320)
        .sheet(isPresented: $showingNewTask) {
            NewTaskView()
                .environmentObject(appState)
        }
    }
}

struct MenuBarTaskRow: View {
    @EnvironmentObject var appState: AppState
    let task: Task

    var body: some View {
        Button {
            appState.openTask(task)
        } label: {
            HStack(spacing: 10) {
                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)

                VStack(alignment: .leading, spacing: 2) {
                    Text(task.id)
                        .font(.system(.body, design: .monospaced))
                        .fontWeight(.medium)

                    Text(task.title)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Project count
                if task.projects.count > 1 {
                    Text("\(task.projects.count)")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.secondary.opacity(0.2))
                        .cornerRadius(4)
                }

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
    }

    private var statusColor: Color {
        // Check if any PR is merged
        let hasMergedPR = task.projects.contains { project in
            project.prs.contains { $0.status == .merged }
        }
        if hasMergedPR { return .purple }

        // Check if any PR is open
        let hasOpenPR = task.projects.contains { project in
            project.prs.contains { $0.status == .open }
        }
        if hasOpenPR { return .green }

        // Default - in progress
        return .blue
    }
}

#Preview {
    MenuBarView()
        .environmentObject(AppState())
}
