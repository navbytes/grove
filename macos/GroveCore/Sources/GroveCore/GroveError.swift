import Foundation

/// Errors that can occur in Grove operations
public enum GroveError: LocalizedError, Sendable {
    case notSetup
    case configNotFound
    case taskNotFound(String)
    case projectNotFound(String)
    case worktreeCreationFailed(String)
    case gitError(String, String)
    case commandFailed(String, String)
    case keychainError(String)
    case networkError(String)
    case jiraError(String)
    case githubError(String)
    case invalidUrl(String)
    case fileSystemError(String)

    public var errorDescription: String? {
        switch self {
        case .notSetup:
            return "Grove is not set up. Run setup first."
        case .configNotFound:
            return "Configuration file not found."
        case .taskNotFound(let id):
            return "Task '\(id)' not found."
        case .projectNotFound(let name):
            return "Project '\(name)' not found."
        case .worktreeCreationFailed(let reason):
            return "Failed to create worktree: \(reason)"
        case .gitError(let command, let output):
            return "Git command '\(command)' failed: \(output)"
        case .commandFailed(let command, let output):
            return "Command '\(command)' failed: \(output)"
        case .keychainError(let reason):
            return "Keychain error: \(reason)"
        case .networkError(let reason):
            return "Network error: \(reason)"
        case .jiraError(let reason):
            return "Jira error: \(reason)"
        case .githubError(let reason):
            return "GitHub error: \(reason)"
        case .invalidUrl(let url):
            return "Invalid URL: \(url)"
        case .fileSystemError(let reason):
            return "File system error: \(reason)"
        }
    }
}
