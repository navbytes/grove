import Foundation
import Security

/// Service for securely storing credentials in the macOS Keychain
public actor KeychainService {
    public static let shared = KeychainService()

    private let service = "com.grove.app"

    private init() {}

    // MARK: - Public API

    /// Store a value in the keychain
    public func store(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw GroveError.keychainError("Failed to encode value")
        }

        // Delete existing item first
        try? delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw GroveError.keychainError("Failed to store item: \(status)")
        }
    }

    /// Retrieve a value from the keychain
    public func retrieve(key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            guard let data = result as? Data,
                  let value = String(data: data, encoding: .utf8) else {
                return nil
            }
            return value
        case errSecItemNotFound:
            return nil
        default:
            throw GroveError.keychainError("Failed to retrieve item: \(status)")
        }
    }

    /// Delete a value from the keychain
    public func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw GroveError.keychainError("Failed to delete item: \(status)")
        }
    }

    /// Check if a key exists in the keychain
    public func exists(key: String) -> Bool {
        do {
            return try retrieve(key: key) != nil
        } catch {
            return false
        }
    }

    // MARK: - Convenience Methods

    /// Get Jira API token
    public func getJiraToken() throws -> String? {
        try retrieve(key: KeychainKeys.jiraApiToken)
    }

    /// Store Jira API token
    public func storeJiraToken(_ token: String) throws {
        try store(key: KeychainKeys.jiraApiToken, value: token)
    }

    /// Get Git API token
    public func getGitToken() throws -> String? {
        try retrieve(key: KeychainKeys.gitApiToken)
    }

    /// Store Git API token
    public func storeGitToken(_ token: String) throws {
        try store(key: KeychainKeys.gitApiToken, value: token)
    }

    /// Delete all Grove tokens
    public func deleteAllTokens() throws {
        try delete(key: KeychainKeys.jiraApiToken)
        try delete(key: KeychainKeys.gitApiToken)
    }
}
