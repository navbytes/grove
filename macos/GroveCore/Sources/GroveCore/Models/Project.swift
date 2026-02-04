import Foundation

// MARK: - Copy Mode
public enum CopyMode: String, Codable, CaseIterable, Sendable {
    case copy
    case symlink
}

// MARK: - Copy Rule
public struct CopyRule: Codable, Identifiable, Sendable, Hashable {
    public let source: String
    public var destination: String?
    public let mode: CopyMode

    public var id: String { source }

    public init(source: String, destination: String? = nil, mode: CopyMode) {
        self.source = source
        self.destination = destination
        self.mode = mode
    }
}

// MARK: - Worktree Setup
public struct WorktreeSetup: Codable, Sendable, Hashable {
    public var copyRules: [CopyRule]
    public var postCreateCommands: [String]

    public init(copyRules: [CopyRule] = [], postCreateCommands: [String] = []) {
        self.copyRules = copyRules
        self.postCreateCommands = postCreateCommands
    }

    public var isEmpty: Bool {
        copyRules.isEmpty && postCreateCommands.isEmpty
    }
}

// MARK: - Project
public struct Project: Codable, Identifiable, Sendable, Hashable {
    public let name: String
    public let repoPath: String
    public var defaultBranch: String
    public var remoteUrl: String?
    public var worktreeSetup: WorktreeSetup?

    public var id: String { name }

    /// Expanded path (resolves ~)
    public var expandedPath: String {
        (repoPath as NSString).expandingTildeInPath
    }

    public init(
        name: String,
        repoPath: String,
        defaultBranch: String,
        remoteUrl: String? = nil,
        worktreeSetup: WorktreeSetup? = nil
    ) {
        self.name = name
        self.repoPath = repoPath
        self.defaultBranch = defaultBranch
        self.remoteUrl = remoteUrl
        self.worktreeSetup = worktreeSetup
    }
}

// MARK: - Projects Store
public struct ProjectsStore: Codable, Sendable {
    public var projects: [Project]

    public init(projects: [Project] = []) {
        self.projects = projects
    }

    public func project(named name: String) -> Project? {
        projects.first { $0.name == name }
    }

    public mutating func add(_ project: Project) {
        if let index = projects.firstIndex(where: { $0.name == project.name }) {
            projects[index] = project
        } else {
            projects.append(project)
        }
    }

    public mutating func remove(named name: String) {
        projects.removeAll { $0.name == name }
    }
}
