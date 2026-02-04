import SwiftUI
import GroveCore

@MainActor
class AppState: ObservableObject {
    // MARK: - Services
    private let configService = ConfigService.shared
    private let taskService = TaskService.shared
    private let worktreeService = WorktreeService.shared

    // MARK: - Published State
    @Published var isSetup = false
    @Published var config: GroveConfig?
    @Published var projects: [Project] = []
    @Published var tasks: [Task] = []
    @Published var isLoading = false
    @Published var error: String?

    // MARK: - Initialization
    init() {
        Task {
            await checkSetup()
        }
    }

    // MARK: - Setup
    func checkSetup() async {
        do {
            isSetup = try await configService.isSetup()
            if isSetup {
                await loadData()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func saveConfig(_ config: GroveConfig, jiraToken: String?, gitToken: String?) async throws {
        try await configService.writeConfig(config)

        if let jiraToken = jiraToken, !jiraToken.isEmpty {
            try KeychainService.storeJiraToken(jiraToken)
        }

        if let gitToken = gitToken, !gitToken.isEmpty {
            try KeychainService.storeGitToken(gitToken)
        }

        self.config = config
        isSetup = true
        await loadData()
    }

    // MARK: - Data Loading
    func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            config = try await configService.readConfig()
            projects = try await configService.readProjects()
            tasks = try await taskService.readTasks()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func refresh() async {
        await loadData()
    }

    // MARK: - Task Operations
    func createTask(
        id: String,
        title: String,
        description: String?,
        jiraUrl: String?,
        selectedProjects: [Project],
        baseBranch: String?
    ) async throws {
        guard let config = config else {
            throw GroveError.notSetup
        }

        isLoading = true
        defer { isLoading = false }

        // Generate branch name
        let branchName = await configService.generateBranchName(
            taskId: id,
            title: title,
            template: config.branchTemplate
        )

        // Create worktrees for each project
        var taskProjects: [TaskProject] = []

        for project in selectedProjects {
            let base = baseBranch ?? config.defaultBaseBranch
            let worktreePath = try await worktreeService.createWorktree(
                repoPath: project.repoPath,
                branchName: branchName,
                baseBranch: base,
                destinationDir: GrovePaths.taskDir(for: id, in: config.workspaceDir).path
            )

            // Execute worktree setup if configured
            if let setup = project.worktreeSetup {
                try await worktreeService.executeSetup(
                    setup: setup,
                    worktreePath: worktreePath,
                    repoPath: project.repoPath
                )
            }

            let taskProject = TaskProject(
                name: project.name,
                repoPath: project.repoPath,
                worktreePath: worktreePath,
                branch: branchName,
                baseBranch: base
            )
            taskProjects.append(taskProject)
        }

        // Create the task
        let task = try await taskService.createTask(
            id: id,
            title: title,
            description: description,
            jiraUrl: jiraUrl,
            projects: taskProjects,
            workspaceDir: config.workspaceDir
        )

        tasks.insert(task, at: 0)
    }

    func openTask(_ task: Task) {
        guard let config = config else { return }

        let workspacePath = GrovePaths.workspaceFile(
            for: task.id,
            in: config.workspaceDir
        ).path

        // Open VS Code with the workspace
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/code")
        process.arguments = [workspacePath]

        do {
            try process.run()
        } catch {
            // Try alternative VS Code paths
            let alternatePaths = [
                "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
                "/opt/homebrew/bin/code",
                NSString(string: "~/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code").expandingTildeInPath
            ]

            for path in alternatePaths {
                let altProcess = Process()
                altProcess.executableURL = URL(fileURLWithPath: path)
                altProcess.arguments = [workspacePath]

                if (try? altProcess.run()) != nil {
                    return
                }
            }

            self.error = "Could not find VS Code. Please ensure it's installed."
        }
    }

    func archiveTask(_ taskId: String) async throws {
        try await taskService.archiveTask(taskId)
        await loadData()
    }

    func deleteTask(_ taskId: String) async throws {
        guard let config = config else { return }

        let task = tasks.first { $0.id == taskId }

        // Remove worktrees
        if let task = task {
            for project in task.projects {
                try? await worktreeService.removeWorktree(
                    repoPath: project.repoPath,
                    worktreePath: project.worktreePath
                )
            }
        }

        // Delete task directory
        let taskDir = GrovePaths.taskDir(for: taskId, in: config.workspaceDir)
        try? FileManager.default.removeItem(at: taskDir)

        // Remove from store
        try await taskService.deleteTaskCompletely(taskId)
        await loadData()
    }

    // MARK: - Project Operations
    func registerProject(_ project: Project) async throws {
        try await configService.registerProject(project)
        await loadData()
    }

    func removeProject(_ projectName: String) async throws {
        var currentProjects = try await configService.readProjects()
        currentProjects.removeAll { $0.name == projectName }

        let store = ProjectsStore(projects: currentProjects)
        let data = try JSONEncoder().encode(store)
        try data.write(to: GrovePaths.projectsFile)

        await loadData()
    }

    // MARK: - Helpers
    var activeTasks: [Task] {
        tasks.filter { $0.status == .active }
    }

    var archivedTasks: [Task] {
        tasks.filter { $0.status == .archived }
    }
}
