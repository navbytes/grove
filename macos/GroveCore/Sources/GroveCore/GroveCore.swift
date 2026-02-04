/// GroveCore - Core library for Grove macOS app
///
/// This module provides the business logic for managing cross-repository
/// task workspaces using git worktrees.
///
/// ## Models
/// - ``Task``: Represents a development task with associated projects
/// - ``Project``: Represents a registered git repository
/// - ``GroveConfig``: Application configuration
///
/// ## Services
/// - ``ConfigService``: Manages configuration and project registration
/// - ``TaskService``: Manages task lifecycle
/// - ``WorktreeService``: Handles git worktree operations
/// - ``KeychainService``: Secure credential storage
///
/// ## Usage
/// ```swift
/// import GroveCore
///
/// let configService = ConfigService()
/// let config = try await configService.readConfig()
/// ```

import Foundation

/// Library version
public let groveCoreVersion = "1.0.0"
