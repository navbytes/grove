import Foundation

/// Service for managing tasks
public actor TaskService {
    public static let shared = TaskService()

    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let configService: ConfigService

    private init() {
        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        decoder = JSONDecoder()
        configService = ConfigService.shared
    }

    // MARK: - Task Store Operations

    /// Read all tasks
    public func readTasks() async throws -> [Task] {
        guard FileManager.default.fileExists(atPath: GrovePaths.tasksFile.path) else {
            return []
        }

        let data = try Data(contentsOf: GrovePaths.tasksFile)

        struct TasksWrapper: Codable {
            let tasks: [Task]
        }

        let wrapper = try decoder.decode(TasksWrapper.self, from: data)
        return wrapper.tasks
    }

    /// Write all tasks
    public func writeTasks(_ tasks: [Task]) async throws {
        try configService.ensureConfigDir()

        struct TasksWrapper: Codable {
            let tasks: [Task]
        }

        let wrapper = TasksWrapper(tasks: tasks)
        let data = try encoder.encode(wrapper)
        try data.write(to: GrovePaths.tasksFile)
    }

    /// Get a task by ID
    public func getTask(_ id: String) async throws -> Task? {
        let tasks = try await readTasks()
        return tasks.first { $0.id == id }
    }

    /// Update a task
    public func updateTask(_ id: String, update: (inout Task) -> Void) async throws {
        var tasks = try await readTasks()
        guard let index = tasks.firstIndex(where: { $0.id == id }) else {
            throw GroveError.taskNotFound(id)
        }

        update(&tasks[index])
        tasks[index].updatedAt = ISO8601DateFormatter().string(from: Date())
        try await writeTasks(tasks)
    }

    /// Delete a task from store
    public func deleteTask(_ id: String) async throws {
        var tasks = try await readTasks()
        tasks.removeAll { $0.id == id }
        try await writeTasks(tasks)
    }

    // MARK: - Task Queries

    /// Get active tasks
    public func getActiveTasks() async throws -> [Task] {
        try await readTasks().filter { $0.status == .active }
    }

    /// Get archived tasks
    public func getArchivedTasks() async throws -> [Task] {
        try await readTasks().filter { $0.status == .archived }
    }

    // MARK: - Task Creation

    /// Create a new task
    public func createTask(
        id: String,
        title: String,
        description: String?,
        jiraUrl: String?,
        projects: [TaskProject],
        workspaceDir: String
    ) async throws -> Task {
        // Create task directory
        let taskDir = GrovePaths.taskDir(for: id, in: workspaceDir)
        try FileManager.default.createDirectory(at: taskDir, withIntermediateDirectories: true)

        // Create VS Code workspace file
        let workspaceFile = GrovePaths.workspaceFile(for: id, in: workspaceDir)
        try createWorkspaceFile(at: workspaceFile, projects: projects, taskId: id)

        // Create the task
        let now = ISO8601DateFormatter().string(from: Date())
        let task = Task(
            id: id,
            title: title,
            jiraTickets: [id],
            jiraUrl: jiraUrl,
            status: .active,
            projects: projects,
            workspaceFile: workspaceFile.path,
            notes: description ?? "",
            createdAt: now,
            updatedAt: now
        )

        // Save task
        var existingTasks = try await readTasks()
        existingTasks.append(task)
        try await writeTasks(existingTasks)

        // Generate context file
        let config = try await configService.readConfig()
        try generateContextFile(for: task, config: config)

        return task
    }

    // MARK: - Task Lifecycle

    /// Archive a task
    public func archiveTask(_ id: String, cleanup: Bool = false) async throws {
        try await updateTask(id) { task in
            task.status = .archived
        }

        if cleanup {
            try await cleanupTask(id)
        }
    }

    /// Delete a task completely
    public func deleteTaskCompletely(_ id: String) async throws {
        guard let task = try await getTask(id) else {
            throw GroveError.taskNotFound(id)
        }

        // Remove worktrees
        let worktreeService = WorktreeService.shared
        for project in task.projects {
            try? await worktreeService.removeWorktree(
                repoPath: project.repoPath,
                worktreePath: project.worktreePath
            )
        }

        // Remove task directory
        let config = try await configService.readConfig()
        let taskDir = GrovePaths.taskDir(for: id, in: config.workspaceDir)
        try? FileManager.default.removeItem(at: taskDir)

        // Remove from store
        try await deleteTask(id)
    }

    /// Cleanup task files (worktrees, workspace)
    private func cleanupTask(_ id: String) async throws {
        guard let task = try await getTask(id) else { return }

        let worktreeService = WorktreeService.shared
        for project in task.projects {
            try? await worktreeService.removeWorktree(
                repoPath: project.repoPath,
                worktreePath: project.worktreePath
            )
        }

        let config = try await configService.readConfig()
        let taskDir = GrovePaths.taskDir(for: id, in: config.workspaceDir)
        try? FileManager.default.removeItem(at: taskDir)
    }

    // MARK: - Workspace File

    private func createWorkspaceFile(
        at url: URL,
        projects: [TaskProject],
        taskId: String
    ) throws {
        let folders = projects.map { project in
            ["name": project.name, "path": project.worktreePath]
        }

        let workspace: [String: Any] = [
            "folders": folders,
            "settings": [
                "grove.taskId": taskId
            ]
        ]

        let data = try JSONSerialization.data(withJSONObject: workspace, options: .prettyPrinted)
        try data.write(to: url)
    }

    // MARK: - Context File

    private func generateContextFile(for task: Task, config: GroveConfig) throws {
        let contextFile = GrovePaths.contextFile(for: task.id, in: config.workspaceDir)

        var content = """
        # \(task.displayTitle)

        ## Quick Links

        """

        if let jiraUrl = task.jiraUrl {
            content += "- [Jira](\(jiraUrl))\n"
        }

        for project in task.projects {
            for pr in project.prs {
                content += "- [\(project.name) PR #\(pr.number)](\(pr.url))\n"
            }
        }

        content += """

        ## Projects

        | Project | Branch | Status |
        |---------|--------|--------|
        """

        for project in task.projects {
            let prStatus = project.primaryPR.map { "#\($0.number) \($0.status.rawValue)" } ?? "No PR"
            content += "| \(project.name) | `\(project.branch)` | \(prStatus) |\n"
        }

        content += """

        ## Notes

        <!-- Add your notes here -->

        """

        try content.write(to: contextFile, atomically: true, encoding: .utf8)
    }
}
