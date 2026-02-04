import SwiftUI
import GroveCore

struct SettingsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gearshape")
                }

            IntegrationsSettingsView()
                .tabItem {
                    Label("Integrations", systemImage: "link")
                }

            ProjectsSettingsView()
                .tabItem {
                    Label("Projects", systemImage: "folder")
                }
        }
        .environmentObject(appState)
        .frame(width: 550, height: 450)
    }
}

// MARK: - General Settings

struct GeneralSettingsView: View {
    @EnvironmentObject var appState: AppState

    @State private var workspaceDir: String = ""
    @State private var branchTemplate: String = ""
    @State private var defaultBaseBranch: String = ""
    @State private var isSaving = false

    var body: some View {
        Form {
            Section {
                HStack {
                    TextField("Workspace Directory", text: $workspaceDir)
                    Button("Browse...") {
                        browseFolder()
                    }
                }

                TextField("Branch Template", text: $branchTemplate)
                Text("Variables: {ticketId}, {slug}")
                    .font(.caption)
                    .foregroundColor(.secondary)

                TextField("Default Base Branch", text: $defaultBaseBranch)
            }

            Section {
                HStack {
                    Spacer()
                    Button("Save") {
                        saveSettings()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSaving)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
        .onAppear {
            loadSettings()
        }
    }

    private func loadSettings() {
        if let config = appState.config {
            workspaceDir = config.workspaceDir
            branchTemplate = config.branchTemplate
            defaultBaseBranch = config.defaultBaseBranch
        } else {
            workspaceDir = "~/grove-workspaces"
            branchTemplate = "{ticketId}-{slug}"
            defaultBaseBranch = "main"
        }
    }

    private func browseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select where Grove should create task workspaces"

        if panel.runModal() == .OK, let url = panel.url {
            workspaceDir = url.path
        }
    }

    private func saveSettings() {
        isSaving = true

        Task {
            do {
                var config = appState.config ?? GroveConfig()
                config.workspaceDir = workspaceDir
                config.branchTemplate = branchTemplate
                config.defaultBaseBranch = defaultBaseBranch

                try await appState.saveConfig(config, jiraToken: nil, gitToken: nil)
            } catch {
                // Handle error
            }

            await MainActor.run {
                isSaving = false
            }
        }
    }
}

// MARK: - Integrations Settings

struct IntegrationsSettingsView: View {
    @EnvironmentObject var appState: AppState

    // Git settings
    @State private var gitEnabled = false
    @State private var gitProvider: GitProvider = .github
    @State private var gitBaseUrl = "https://github.com"
    @State private var gitOrg = ""
    @State private var gitToken = ""
    @State private var gitTestResult: TestResult?
    @State private var gitTesting = false

    // Jira settings
    @State private var jiraEnabled = false
    @State private var jiraBaseUrl = ""
    @State private var jiraEmail = ""
    @State private var jiraToken = ""
    @State private var jiraTestResult: TestResult?
    @State private var jiraTesting = false

    @State private var isSaving = false

    enum TestResult {
        case success
        case failure(String)
    }

    var body: some View {
        Form {
            // Git Section
            Section {
                Toggle("Enable GitHub/GitLab Integration", isOn: $gitEnabled)

                if gitEnabled {
                    Picker("Provider", selection: $gitProvider) {
                        Text("GitHub").tag(GitProvider.github)
                        Text("GitLab").tag(GitProvider.gitlab)
                        Text("Bitbucket").tag(GitProvider.bitbucket)
                    }
                    .onChange(of: gitProvider) { _, newValue in
                        gitBaseUrl = newValue.defaultBaseUrl
                    }

                    TextField("Base URL", text: $gitBaseUrl)

                    TextField("Organization", text: $gitOrg)

                    SecureField("API Token", text: $gitToken)

                    HStack {
                        Link("Generate Token", destination: URL(string: gitProvider.tokenGenerationUrl)!)
                            .font(.caption)

                        Spacer()

                        testResultView(gitTestResult)

                        Button("Test") {
                            testGitConnection()
                        }
                        .disabled(gitToken.isEmpty || gitTesting)
                    }
                }
            } header: {
                Text("Git Provider")
            }

            // Jira Section
            Section {
                Toggle("Enable Jira Integration", isOn: $jiraEnabled)

                if jiraEnabled {
                    TextField("Base URL", text: $jiraBaseUrl)
                    Text("e.g., https://your-org.atlassian.net")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    TextField("Email", text: $jiraEmail)

                    SecureField("API Token", text: $jiraToken)

                    HStack {
                        Link("Generate Token", destination: URL(string: JiraConfig.tokenGenerationUrl)!)
                            .font(.caption)

                        Spacer()

                        testResultView(jiraTestResult)

                        Button("Test") {
                            testJiraConnection()
                        }
                        .disabled(jiraToken.isEmpty || jiraTesting)
                    }
                }
            } header: {
                Text("Jira")
            }

            Section {
                HStack {
                    Spacer()
                    Button("Save Integrations") {
                        saveIntegrations()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSaving)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
        .onAppear {
            loadSettings()
        }
    }

    @ViewBuilder
    private func testResultView(_ result: TestResult?) -> some View {
        if let result = result {
            switch result {
            case .success:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            case .failure(let message):
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red)
                    .help(message)
            }
        }
    }

    private func loadSettings() {
        if let config = appState.config {
            if let git = config.git {
                gitEnabled = true
                gitProvider = git.provider
                gitBaseUrl = git.baseUrl
                gitOrg = git.org
            }

            if let jira = config.jira {
                jiraEnabled = true
                jiraBaseUrl = jira.baseUrl
                jiraEmail = jira.email
            }
        }

        // Load tokens from keychain
        if let token = try? KeychainService.getGitToken() {
            gitToken = token
        }

        if let token = try? KeychainService.getJiraToken() {
            jiraToken = token
        }
    }

    private func testGitConnection() {
        gitTesting = true
        gitTestResult = nil

        Task {
            do {
                let apiUrl = gitBaseUrl == "https://github.com"
                    ? "https://api.github.com/user"
                    : "\(gitBaseUrl)/api/v3/user"

                var request = URLRequest(url: URL(string: apiUrl)!)
                request.setValue("Bearer \(gitToken)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Accept")

                let (_, response) = try await URLSession.shared.data(for: request)

                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    await MainActor.run {
                        gitTestResult = .success
                    }
                } else {
                    await MainActor.run {
                        gitTestResult = .failure("Authentication failed")
                    }
                }
            } catch {
                await MainActor.run {
                    gitTestResult = .failure(error.localizedDescription)
                }
            }

            await MainActor.run {
                gitTesting = false
            }
        }
    }

    private func testJiraConnection() {
        jiraTesting = true
        jiraTestResult = nil

        Task {
            do {
                let apiUrl = "\(jiraBaseUrl)/rest/api/3/myself"
                var request = URLRequest(url: URL(string: apiUrl)!)

                let credentials = "\(jiraEmail):\(jiraToken)"
                let base64 = Data(credentials.utf8).base64EncodedString()
                request.setValue("Basic \(base64)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Accept")

                let (_, response) = try await URLSession.shared.data(for: request)

                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    await MainActor.run {
                        jiraTestResult = .success
                    }
                } else {
                    await MainActor.run {
                        jiraTestResult = .failure("Authentication failed")
                    }
                }
            } catch {
                await MainActor.run {
                    jiraTestResult = .failure(error.localizedDescription)
                }
            }

            await MainActor.run {
                jiraTesting = false
            }
        }
    }

    private func saveIntegrations() {
        isSaving = true

        Task {
            do {
                var config = appState.config ?? GroveConfig()

                if gitEnabled {
                    config.git = GitConfig(
                        provider: gitProvider,
                        baseUrl: gitBaseUrl,
                        org: gitOrg
                    )
                } else {
                    config.git = nil
                }

                if jiraEnabled {
                    config.jira = JiraConfig(
                        baseUrl: jiraBaseUrl,
                        email: jiraEmail
                    )
                } else {
                    config.jira = nil
                }

                try await appState.saveConfig(
                    config,
                    jiraToken: jiraEnabled && !jiraToken.isEmpty ? jiraToken : nil,
                    gitToken: gitEnabled && !gitToken.isEmpty ? gitToken : nil
                )
            } catch {
                // Handle error
            }

            await MainActor.run {
                isSaving = false
            }
        }
    }
}

// MARK: - Projects Settings

struct ProjectsSettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingAddProject = false
    @State private var projectToDelete: Project?

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack {
                Text("Registered Projects")
                    .font(.headline)
                Spacer()
                Button {
                    showingAddProject = true
                } label: {
                    Label("Add Project", systemImage: "plus")
                }
            }
            .padding()

            Divider()

            if appState.projects.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "folder.badge.plus")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No projects registered")
                        .foregroundColor(.secondary)
                    Text("Add a git repository to create worktrees from")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(appState.projects) { project in
                        ProjectRow(project: project) {
                            projectToDelete = project
                        }
                    }
                }
                .listStyle(.inset)
            }
        }
        .sheet(isPresented: $showingAddProject) {
            AddProjectView()
                .environmentObject(appState)
        }
        .confirmationDialog(
            "Remove Project",
            isPresented: Binding(
                get: { projectToDelete != nil },
                set: { if !$0 { projectToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let project = projectToDelete {
                    Task {
                        try? await appState.removeProject(project.name)
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Remove \(projectToDelete?.name ?? "")? This will not delete the repository.")
        }
    }
}

struct ProjectRow: View {
    let project: Project
    let onDelete: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(project.name)
                    .fontWeight(.medium)
                Text(project.repoPath)
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let setup = project.worktreeSetup {
                    HStack(spacing: 4) {
                        if !setup.copyRules.isEmpty {
                            Label("\(setup.copyRules.count) copy rules", systemImage: "doc.on.doc")
                        }
                        if !setup.postCreateCommands.isEmpty {
                            Label("\(setup.postCreateCommands.count) commands", systemImage: "terminal")
                        }
                    }
                    .font(.caption2)
                    .foregroundColor(.secondary)
                }
            }

            Spacer()

            Button(role: .destructive) {
                onDelete()
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Add Project View

struct AddProjectView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var repoPath = ""
    @State private var defaultBranch = "main"
    @State private var error: String?
    @State private var isSaving = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Add Project")
                    .font(.title3)
                    .fontWeight(.semibold)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()

            Divider()

            Form {
                TextField("Project Name", text: $name)
                Text("A short identifier for this project")
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack {
                    TextField("Repository Path", text: $repoPath)
                    Button("Browse...") {
                        browseRepo()
                    }
                }
                Text("Path to the git repository")
                    .font(.caption)
                    .foregroundColor(.secondary)

                TextField("Default Branch", text: $defaultBranch)

                if let error = error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                }
            }
            .formStyle(.grouped)
            .padding()

            Divider()

            HStack {
                Button("Cancel") {
                    dismiss()
                }
                Spacer()
                Button("Add Project") {
                    addProject()
                }
                .buttonStyle(.borderedProminent)
                .disabled(name.isEmpty || repoPath.isEmpty || isSaving)
            }
            .padding()
        }
        .frame(width: 400, height: 350)
    }

    private func browseRepo() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select a git repository"

        if panel.runModal() == .OK, let url = panel.url {
            repoPath = url.path

            // Auto-fill name from directory name if empty
            if name.isEmpty {
                name = url.lastPathComponent
            }
        }
    }

    private func addProject() {
        // Validate path is a git repo
        let gitDir = URL(fileURLWithPath: repoPath).appendingPathComponent(".git")
        guard FileManager.default.fileExists(atPath: gitDir.path) else {
            error = "Not a valid git repository"
            return
        }

        isSaving = true

        let project = Project(
            name: name,
            repoPath: repoPath,
            defaultBranch: defaultBranch,
            worktreeSetup: nil
        )

        Task {
            do {
                try await appState.registerProject(project)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isSaving = false
                }
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
