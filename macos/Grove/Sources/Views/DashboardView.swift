import SwiftUI
import GroveCore

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedFilter: TaskFilter = .active
    @State private var showingNewTask = false
    @State private var searchText = ""

    enum TaskFilter: String, CaseIterable {
        case active = "Active"
        case archived = "Archived"
        case all = "All"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            Divider()

            // Content
            if !appState.isSetup {
                setupPromptView
            } else if filteredTasks.isEmpty {
                emptyStateView
            } else {
                taskListView
            }
        }
        .background(Color(NSColor.windowBackgroundColor))
        .sheet(isPresented: $showingNewTask) {
            NewTaskView()
                .environmentObject(appState)
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(spacing: 16) {
            // Logo and title
            HStack(spacing: 8) {
                Image(systemName: "leaf.fill")
                    .font(.title2)
                    .foregroundColor(.green)
                Text("Grove")
                    .font(.title2)
                    .fontWeight(.semibold)
            }

            Spacer()

            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search tasks...", text: $searchText)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)
            .frame(maxWidth: 250)

            // Filter
            Picker("Filter", selection: $selectedFilter) {
                ForEach(TaskFilter.allCases, id: \.self) { filter in
                    Text(filter.rawValue).tag(filter)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 200)

            // New task button
            Button {
                showingNewTask = true
            } label: {
                Label("New Task", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)

            // Refresh
            Button {
                Task {
                    await appState.refresh()
                }
            } label: {
                if appState.isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderless)
            .disabled(appState.isLoading)
        }
        .padding()
    }

    // MARK: - Content Views

    private var setupPromptView: some View {
        VStack(spacing: 20) {
            Image(systemName: "gearshape.2")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text("Welcome to Grove")
                .font(.title)
                .fontWeight(.semibold)

            Text("Set up Grove to start managing your development tasks")
                .foregroundColor(.secondary)

            Button("Open Settings") {
                NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: selectedFilter == .active ? "tray" : "archivebox")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text(selectedFilter == .active ? "No active tasks" : "No archived tasks")
                .font(.title2)
                .fontWeight(.medium)

            if selectedFilter == .active {
                Text("Create your first task to get started")
                    .foregroundColor(.secondary)

                Button {
                    showingNewTask = true
                } label: {
                    Label("New Task", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var taskListView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredTasks) { task in
                    TaskCard(task: task)
                }
            }
            .padding()
        }
    }

    // MARK: - Computed

    private var filteredTasks: [Task] {
        var tasks: [Task]

        switch selectedFilter {
        case .active:
            tasks = appState.activeTasks
        case .archived:
            tasks = appState.archivedTasks
        case .all:
            tasks = appState.tasks
        }

        if searchText.isEmpty {
            return tasks
        }

        let search = searchText.lowercased()
        return tasks.filter { task in
            task.id.lowercased().contains(search) ||
            task.title.lowercased().contains(search) ||
            (task.description?.lowercased().contains(search) ?? false)
        }
    }
}

// MARK: - Task Card

struct TaskCard: View {
    @EnvironmentObject var appState: AppState
    let task: Task
    @State private var isHovered = false
    @State private var showingDeleteConfirmation = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                // Task ID
                Text(task.id)
                    .font(.system(.headline, design: .monospaced))
                    .foregroundColor(.primary)

                // Status badge
                Text(task.status.rawValue.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .cornerRadius(4)

                Spacer()

                // Time
                Text(task.updatedAt, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Title
            Text(task.title)
                .font(.body)
                .foregroundColor(.secondary)

            // Projects
            HStack(spacing: 8) {
                ForEach(task.projects, id: \.name) { project in
                    ProjectBadge(project: project)
                }
            }

            // Actions (shown on hover)
            if isHovered || task.status == .active {
                Divider()

                HStack(spacing: 12) {
                    Button {
                        appState.openTask(task)
                    } label: {
                        Label("Open in VS Code", systemImage: "chevron.left.forwardslash.chevron.right")
                    }
                    .buttonStyle(.bordered)

                    if let jiraUrl = task.jiraUrl {
                        Link(destination: URL(string: jiraUrl)!) {
                            Label("Jira", systemImage: "link")
                        }
                        .buttonStyle(.bordered)
                    }

                    Spacer()

                    if task.status == .active {
                        Button {
                            Task {
                                try? await appState.archiveTask(task.id)
                            }
                        } label: {
                            Label("Archive", systemImage: "archivebox")
                        }
                        .buttonStyle(.bordered)
                    }

                    Button(role: .destructive) {
                        showingDeleteConfirmation = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
        .shadow(color: .black.opacity(isHovered ? 0.1 : 0.05), radius: isHovered ? 8 : 4)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
        .confirmationDialog(
            "Delete Task",
            isPresented: $showingDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task {
                    try? await appState.deleteTask(task.id)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will remove the task and all its worktrees. This cannot be undone.")
        }
    }

    private var statusColor: Color {
        switch task.status {
        case .active: return .green
        case .archived: return .gray
        }
    }
}

// MARK: - Project Badge

struct ProjectBadge: View {
    let project: TaskProject

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "folder")
                .font(.caption)

            Text(project.name)
                .font(.caption)
                .fontWeight(.medium)

            if let pr = project.prs.first {
                prStatusIcon(pr.status)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.secondary.opacity(0.1))
        .cornerRadius(6)
    }

    @ViewBuilder
    private func prStatusIcon(_ status: PRStatus) -> some View {
        switch status {
        case .draft:
            Image(systemName: "doc")
                .foregroundColor(.gray)
        case .open:
            Image(systemName: "arrow.triangle.pull")
                .foregroundColor(.green)
        case .merged:
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.purple)
        case .closed:
            Image(systemName: "xmark.circle")
                .foregroundColor(.red)
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AppState())
        .frame(width: 800, height: 600)
}
