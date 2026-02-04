import Foundation

// MARK: - Task Status
public enum TaskStatus: String, Codable, CaseIterable, Sendable {
    case active
    case archived
    case completed
}

// MARK: - PR Status
public enum PRStatus: String, Codable, CaseIterable, Sendable {
    case open
    case closed
    case merged
    case draft
}

// MARK: - Review Status
public enum ReviewStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case approved
    case changesRequested = "changes_requested"
    case commented
}

// MARK: - CI Status
public enum CIStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case running
    case passed
    case failed
    case cancelled
}

// MARK: - Link Type
public enum LinkType: String, Codable, CaseIterable, Sendable {
    case confluence
    case notion
    case googleDocs = "google-docs"
    case figma
    case other
}

// MARK: - PR Info
public struct PRInfo: Codable, Identifiable, Sendable, Hashable {
    public let number: Int
    public let url: String
    public var status: PRStatus
    public var reviewStatus: ReviewStatus
    public var ciStatus: CIStatus
    public var title: String?
    public var updatedAt: String?

    public var id: Int { number }

    public init(
        number: Int,
        url: String,
        status: PRStatus,
        reviewStatus: ReviewStatus,
        ciStatus: CIStatus,
        title: String? = nil,
        updatedAt: String? = nil
    ) {
        self.number = number
        self.url = url
        self.status = status
        self.reviewStatus = reviewStatus
        self.ciStatus = ciStatus
        self.title = title
        self.updatedAt = updatedAt
    }
}

// MARK: - Slack Thread
public struct SlackThread: Codable, Identifiable, Sendable, Hashable {
    public let url: String
    public var title: String?
    public let addedAt: String

    public var id: String { url }

    public init(url: String, title: String? = nil, addedAt: String) {
        self.url = url
        self.title = title
        self.addedAt = addedAt
    }
}

// MARK: - Task Link
public struct TaskLink: Codable, Identifiable, Sendable, Hashable {
    public let url: String
    public var title: String?
    public let type: LinkType
    public let addedAt: String

    public var id: String { url }

    public init(url: String, title: String? = nil, type: LinkType, addedAt: String) {
        self.url = url
        self.title = title
        self.type = type
        self.addedAt = addedAt
    }
}

// MARK: - Task Project
public struct TaskProject: Codable, Identifiable, Sendable, Hashable {
    public let name: String
    public let repoPath: String
    public let worktreePath: String
    public let branch: String
    public let baseBranch: String
    public var prs: [PRInfo]

    public var id: String { name }

    /// Primary PR (first in list)
    public var primaryPR: PRInfo? { prs.first }

    /// Has any open PR
    public var hasOpenPR: Bool {
        prs.contains { $0.status == .open || $0.status == .draft }
    }

    public init(
        name: String,
        repoPath: String,
        worktreePath: String,
        branch: String,
        baseBranch: String,
        prs: [PRInfo] = []
    ) {
        self.name = name
        self.repoPath = repoPath
        self.worktreePath = worktreePath
        self.branch = branch
        self.baseBranch = baseBranch
        self.prs = prs
    }
}

// MARK: - Task
public struct Task: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public var title: String
    public var jiraTickets: [String]
    public var jiraUrl: String?
    public var status: TaskStatus
    public var projects: [TaskProject]
    public let workspaceFile: String
    public var notes: String
    public var slackThreads: [SlackThread]
    public var links: [TaskLink]?
    public let createdAt: String
    public var updatedAt: String

    /// Primary ticket ID
    public var primaryTicket: String? { jiraTickets.first }

    /// Display title with ticket prefix
    public var displayTitle: String {
        if let ticket = primaryTicket {
            return "\(ticket): \(title)"
        }
        return title
    }

    /// All PRs across all projects
    public var allPRs: [PRInfo] {
        projects.flatMap { $0.prs }
    }

    /// Overall CI status (worst status across all PRs)
    public var overallCIStatus: CIStatus? {
        let statuses = allPRs.map { $0.ciStatus }
        if statuses.contains(.failed) { return .failed }
        if statuses.contains(.running) { return .running }
        if statuses.contains(.pending) { return .pending }
        if statuses.contains(.passed) { return .passed }
        return nil
    }

    public init(
        id: String,
        title: String,
        jiraTickets: [String],
        jiraUrl: String? = nil,
        status: TaskStatus = .active,
        projects: [TaskProject] = [],
        workspaceFile: String,
        notes: String = "",
        slackThreads: [SlackThread] = [],
        links: [TaskLink]? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.title = title
        self.jiraTickets = jiraTickets
        self.jiraUrl = jiraUrl
        self.status = status
        self.projects = projects
        self.workspaceFile = workspaceFile
        self.notes = notes
        self.slackThreads = slackThreads
        self.links = links
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
