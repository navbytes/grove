import Foundation

// MARK: - Git Provider
public enum GitProvider: String, Codable, CaseIterable, Sendable {
    case github
    case gitlab
    case bitbucket

    public var displayName: String {
        switch self {
        case .github: return "GitHub"
        case .gitlab: return "GitLab"
        case .bitbucket: return "Bitbucket"
        }
    }

    public var defaultBaseUrl: String {
        switch self {
        case .github: return "https://github.com"
        case .gitlab: return "https://gitlab.com"
        case .bitbucket: return "https://bitbucket.org"
        }
    }

    public var tokenGenerationUrl: String {
        switch self {
        case .github: return "https://github.com/settings/tokens/new?scopes=repo&description=Grove"
        case .gitlab: return "https://gitlab.com/-/user_settings/personal_access_tokens"
        case .bitbucket: return "https://bitbucket.org/account/settings/app-passwords/"
        }
    }
}

// MARK: - Jira Config
public struct JiraConfig: Codable, Sendable, Hashable {
    public var baseUrl: String
    public var email: String

    public init(baseUrl: String, email: String) {
        self.baseUrl = baseUrl
        self.email = email
    }

    public static let tokenGenerationUrl = "https://id.atlassian.com/manage-profile/security/api-tokens"
}

// MARK: - Git Config
public struct GitConfig: Codable, Sendable, Hashable {
    public var provider: GitProvider
    public var baseUrl: String
    public var org: String

    public init(provider: GitProvider, baseUrl: String, org: String) {
        self.provider = provider
        self.baseUrl = baseUrl
        self.org = org
    }
}

// MARK: - CI Config
public struct CIConfig: Codable, Sendable, Hashable {
    public var provider: String
    public var baseUrl: String?

    public init(provider: String, baseUrl: String? = nil) {
        self.provider = provider
        self.baseUrl = baseUrl
    }
}

// MARK: - Grove Config
public struct GroveConfig: Codable, Sendable {
    public var workspaceDir: String
    public var jira: JiraConfig?
    public var git: GitConfig?
    public var ci: CIConfig?
    public var branchPrefix: String
    public var branchTemplate: String
    public var defaultBaseBranch: String
    public var pollingInterval: Int

    /// Expanded workspace directory path
    public var expandedWorkspaceDir: String {
        (workspaceDir as NSString).expandingTildeInPath
    }

    public init(
        workspaceDir: String = "~/grove-workspaces",
        jira: JiraConfig? = nil,
        git: GitConfig? = nil,
        ci: CIConfig? = nil,
        branchPrefix: String = "",
        branchTemplate: String = "{ticketId}-{slug}",
        defaultBaseBranch: String = "main",
        pollingInterval: Int = 300
    ) {
        self.workspaceDir = workspaceDir
        self.jira = jira
        self.git = git
        self.ci = ci
        self.branchPrefix = branchPrefix
        self.branchTemplate = branchTemplate
        self.defaultBaseBranch = defaultBaseBranch
        self.pollingInterval = pollingInterval
    }

    public static let `default` = GroveConfig()
}

// MARK: - Grove Paths
public enum GrovePaths {
    public static let configDir: URL = {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home.appendingPathComponent(".grove")
    }()

    public static let configFile = configDir.appendingPathComponent("config.json")
    public static let projectsFile = configDir.appendingPathComponent("projects.json")
    public static let tasksFile = configDir.appendingPathComponent("tasks.json")

    public static func taskDir(for taskId: String, in workspaceDir: String) -> URL {
        let expanded = (workspaceDir as NSString).expandingTildeInPath
        return URL(fileURLWithPath: expanded).appendingPathComponent(taskId)
    }

    public static func workspaceFile(for taskId: String, in workspaceDir: String) -> URL {
        taskDir(for: taskId, in: workspaceDir)
            .appendingPathComponent("\(taskId).code-workspace")
    }

    public static func contextFile(for taskId: String, in workspaceDir: String) -> URL {
        taskDir(for: taskId, in: workspaceDir)
            .appendingPathComponent("CONTEXT.md")
    }
}

// MARK: - Keychain Keys
public enum KeychainKeys {
    public static let jiraApiToken = "grove.jira.apiToken"
    public static let gitApiToken = "grove.git.apiToken"
}
