import Foundation

/// Service for managing git worktrees
public actor WorktreeService {
    public static let shared = WorktreeService()

    private init() {}

    // MARK: - Worktree Operations

    /// Create a new worktree
    @discardableResult
    public func createWorktree(
        repoPath: String,
        branchName: String,
        baseBranch: String,
        destinationDir: String
    ) async throws -> String {
        // First, fetch to ensure we have the latest
        try await runGit(["fetch", "origin"], in: repoPath)

        // Create destination directory
        let fm = FileManager.default
        try fm.createDirectory(atPath: destinationDir, withIntermediateDirectories: true)

        // Worktree path is destination + repo name
        let repoName = URL(fileURLWithPath: repoPath).lastPathComponent
        let worktreePath = (destinationDir as NSString).appendingPathComponent(repoName)

        // Create the worktree with new branch
        try await runGit(
            ["worktree", "add", "-b", branchName, worktreePath, "origin/\(baseBranch)"],
            in: repoPath
        )

        return worktreePath
    }

    /// Remove a worktree
    public func removeWorktree(
        repoPath: String,
        worktreePath: String
    ) async throws {
        // Try to remove the worktree
        try await runGit(["worktree", "remove", worktreePath, "--force"], in: repoPath)

        // Prune any stale worktrees
        try? await runGit(["worktree", "prune"], in: repoPath)
    }

    /// List worktrees for a repository
    public func listWorktrees(repoPath: String) async throws -> [String] {
        let output = try await runGit(["worktree", "list", "--porcelain"], in: repoPath)
        return output
            .components(separatedBy: "\n")
            .filter { $0.hasPrefix("worktree ") }
            .map { String($0.dropFirst("worktree ".count)) }
    }

    // MARK: - Branch Operations

    /// Check if branch is pushed to remote
    public func isBranchPushed(repoPath: String, branch: String) async throws -> Bool {
        do {
            _ = try await runGit(
                ["rev-parse", "--verify", "origin/\(branch)"],
                in: repoPath
            )
            return true
        } catch {
            return false
        }
    }

    /// Push a branch to remote
    public func pushBranch(worktreePath: String, branch: String) async throws {
        try await runGit(["push", "-u", "origin", branch], in: worktreePath)
    }

    /// Detect default branch for a repository
    public func detectDefaultBranch(repoPath: String) async throws -> String {
        // Try to get the default branch from remote
        do {
            let output = try await runGit(
                ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
                in: repoPath
            )
            let branch = output.trimmingCharacters(in: .whitespacesAndNewlines)
            if branch.hasPrefix("origin/") {
                return String(branch.dropFirst("origin/".count))
            }
            return branch
        } catch {
            // Fallback: check if main or master exists
            for branch in ["main", "master"] {
                do {
                    _ = try await runGit(
                        ["rev-parse", "--verify", "origin/\(branch)"],
                        in: repoPath
                    )
                    return branch
                } catch {
                    continue
                }
            }
            return "main"
        }
    }

    /// Get remote URL for a repository
    public func getRemoteUrl(repoPath: String) async throws -> String {
        let output = try await runGit(["remote", "get-url", "origin"], in: repoPath)
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Worktree Setup

    /// Execute worktree setup (copy files, run commands)
    public func executeSetup(
        setup: WorktreeSetup,
        worktreePath: String,
        repoPath: String
    ) async throws {
        // Copy files
        for rule in setup.copyRules {
            try await executeCopyRule(
                rule: rule,
                repoPath: repoPath,
                worktreePath: worktreePath
            )
        }

        // Run post-create commands
        for command in setup.postCreateCommands {
            try await executeCommand(command, in: worktreePath)
        }
    }

    private func executeCopyRule(
        rule: CopyRule,
        repoPath: String,
        worktreePath: String
    ) async throws {
        let fm = FileManager.default

        // Determine source path
        let sourcePath: String
        if rule.source.hasPrefix("~/") {
            sourcePath = (rule.source as NSString).expandingTildeInPath
        } else if rule.source.hasPrefix("/") {
            sourcePath = rule.source
        } else {
            sourcePath = (repoPath as NSString).appendingPathComponent(rule.source)
        }

        // Determine destination path
        let destRelative = rule.destination ?? rule.source
        let destPath = (worktreePath as NSString).appendingPathComponent(destRelative)

        // Ensure destination directory exists
        let destDir = (destPath as NSString).deletingLastPathComponent
        try fm.createDirectory(atPath: destDir, withIntermediateDirectories: true)

        // Remove existing file if present
        try? fm.removeItem(atPath: destPath)

        // Copy or symlink based on mode
        switch rule.mode {
        case .copy:
            try fm.copyItem(atPath: sourcePath, toPath: destPath)
        case .symlink:
            try fm.createSymbolicLink(atPath: destPath, withDestinationPath: sourcePath)
        }
    }

    private func executeCommand(_ command: String, in cwd: String) async throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["-c", command]
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        try process.run()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""
            throw GroveError.commandFailed(command, output)
        }
    }

    // MARK: - Git Execution

    @discardableResult
    private func runGit(_ arguments: [String], in directory: String) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = arguments
        process.currentDirectoryURL = URL(fileURLWithPath: directory)

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        try process.run()
        process.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8) ?? ""

        if process.terminationStatus != 0 {
            throw GroveError.gitError(arguments.joined(separator: " "), output)
        }

        return output
    }
}
