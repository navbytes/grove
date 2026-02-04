import SwiftUI
import GroveCore

struct NewTaskView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var taskId = ""
    @State private var title = ""
    @State private var description = ""
    @State private var jiraUrl = ""
    @State private var baseBranch = ""
    @State private var selectedProjects: Set<String> = []
    @State private var isCreating = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("New Task")
                    .font(.title2)
                    .fontWeight(.semibold)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()

            Divider()

            // Form
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Task ID
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Task ID")
                            .font(.headline)
                        TextField("e.g., PROJ-123", text: $taskId)
                            .textFieldStyle(.roundedBorder)
                        Text("This will be used for the branch name and workspace directory")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Title
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Title")
                            .font(.headline)
                        TextField("Brief description of the task", text: $title)
                            .textFieldStyle(.roundedBorder)
                    }

                    // Description (optional)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .font(.headline)
                        TextEditor(text: $description)
                            .frame(minHeight: 60)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.secondary.opacity(0.3))
                            )
                        Text("Optional additional context")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Jira URL (optional)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Jira URL")
                            .font(.headline)
                        TextField("https://your-org.atlassian.net/browse/PROJ-123", text: $jiraUrl)
                            .textFieldStyle(.roundedBorder)
                        Text("Optional link to the Jira ticket")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Base Branch
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Base Branch")
                            .font(.headline)
                        TextField(appState.config?.defaultBaseBranch ?? "main", text: $baseBranch)
                            .textFieldStyle(.roundedBorder)
                        Text("Leave empty to use default: \(appState.config?.defaultBaseBranch ?? "main")")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Projects
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Projects")
                            .font(.headline)

                        if appState.projects.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "folder.badge.questionmark")
                                    .font(.largeTitle)
                                    .foregroundColor(.secondary)
                                Text("No projects registered")
                                    .foregroundColor(.secondary)
                                Button("Open Settings to add projects") {
                                    NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
                                }
                                .buttonStyle(.bordered)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(8)
                        } else {
                            VStack(spacing: 8) {
                                ForEach(appState.projects) { project in
                                    ProjectSelectionRow(
                                        project: project,
                                        isSelected: selectedProjects.contains(project.name),
                                        onToggle: {
                                            if selectedProjects.contains(project.name) {
                                                selectedProjects.remove(project.name)
                                            } else {
                                                selectedProjects.insert(project.name)
                                            }
                                        }
                                    )
                                }
                            }
                        }

                        Text("Select the repositories to create worktrees for")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // Error message
                    if let error = error {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.red)
                            Text(error)
                                .foregroundColor(.red)
                        }
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                    }
                }
                .padding()
            }

            Divider()

            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.escape)

                Spacer()

                Button {
                    createTask()
                } label: {
                    if isCreating {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Text("Create Task")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!isValid || isCreating)
                .keyboardShortcut(.return)
            }
            .padding()
        }
        .frame(width: 500, height: 650)
    }

    private var isValid: Bool {
        !taskId.isEmpty && !title.isEmpty && !selectedProjects.isEmpty
    }

    private func createTask() {
        guard isValid else { return }

        isCreating = true
        error = nil

        let projectsToUse = appState.projects.filter { selectedProjects.contains($0.name) }

        Task {
            do {
                try await appState.createTask(
                    id: taskId,
                    title: title,
                    description: description.isEmpty ? nil : description,
                    jiraUrl: jiraUrl.isEmpty ? nil : jiraUrl,
                    selectedProjects: projectsToUse,
                    baseBranch: baseBranch.isEmpty ? nil : baseBranch
                )

                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isCreating = false
                }
            }
        }
    }
}

struct ProjectSelectionRow: View {
    let project: Project
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack {
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .foregroundColor(isSelected ? .accentColor : .secondary)

                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name)
                        .fontWeight(.medium)

                    Text(project.repoPath)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if project.worktreeSetup != nil {
                    Image(systemName: "gearshape")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .help("Has worktree setup configured")
                }
            }
            .padding(10)
            .background(isSelected ? Color.accentColor.opacity(0.1) : Color.secondary.opacity(0.05))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NewTaskView()
        .environmentObject(AppState())
}
