import Foundation

/// Service for managing Grove configuration
public actor ConfigService {
    public static let shared = ConfigService()

    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    private init() {
        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        decoder = JSONDecoder()
    }

    // MARK: - Directory Management

    /// Ensures the .grove directory exists
    public func ensureConfigDir() throws {
        let fm = FileManager.default
        if !fm.fileExists(atPath: GrovePaths.configDir.path) {
            try fm.createDirectory(at: GrovePaths.configDir, withIntermediateDirectories: true)
        }
    }

    /// Ensures the workspace directory exists
    public func ensureWorkspaceDir(config: GroveConfig) throws {
        let fm = FileManager.default
        let path = config.expandedWorkspaceDir
        if !fm.fileExists(atPath: path) {
            try fm.createDirectory(atPath: path, withIntermediateDirectories: true)
        }
    }

    // MARK: - Config Operations

    /// Check if Grove is set up
    public func isSetup() async throws -> Bool {
        FileManager.default.fileExists(atPath: GrovePaths.configFile.path)
    }

    /// Read the Grove configuration
    public func readConfig() async throws -> GroveConfig {
        guard FileManager.default.fileExists(atPath: GrovePaths.configFile.path) else {
            return .default
        }

        let data = try Data(contentsOf: GrovePaths.configFile)
        return try decoder.decode(GroveConfig.self, from: data)
    }

    /// Write the Grove configuration
    public func writeConfig(_ config: GroveConfig) async throws {
        try ensureConfigDir()
        let data = try encoder.encode(config)
        try data.write(to: GrovePaths.configFile)
    }

    // MARK: - Projects Operations

    /// Read registered projects
    public func readProjects() async throws -> [Project] {
        guard FileManager.default.fileExists(atPath: GrovePaths.projectsFile.path) else {
            return []
        }

        let data = try Data(contentsOf: GrovePaths.projectsFile)
        let store = try decoder.decode(ProjectsStore.self, from: data)
        return store.projects
    }

    /// Write projects
    public func writeProjects(_ projects: [Project]) async throws {
        try ensureConfigDir()
        let store = ProjectsStore(projects: projects)
        let data = try encoder.encode(store)
        try data.write(to: GrovePaths.projectsFile)
    }

    /// Register a new project
    public func registerProject(_ project: Project) async throws {
        var projects = try await readProjects()
        if let index = projects.firstIndex(where: { $0.name == project.name }) {
            projects[index] = project
        } else {
            projects.append(project)
        }
        try await writeProjects(projects)
    }

    /// Remove a project
    public func removeProject(named name: String) async throws {
        var projects = try await readProjects()
        projects.removeAll { $0.name == name }
        try await writeProjects(projects)
    }

    /// Get a project by name
    public func getProject(named name: String) async throws -> Project? {
        let projects = try await readProjects()
        return projects.first { $0.name == name }
    }

    // MARK: - Branch Name Generation

    /// Generate a branch name from template
    public func generateBranchName(
        taskId: String,
        title: String,
        template: String
    ) -> String {
        let slug = title
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
            .joined()
            .prefix(50)

        let branch = template
            .replacingOccurrences(of: "{ticketId}", with: taskId)
            .replacingOccurrences(of: "{slug}", with: String(slug))
            .replacingOccurrences(of: "{title}", with: String(slug))

        return branch
    }
}
