<script lang="ts">
  import type { SetupConfig, GitProvider, ConnectionTestResult, SetupMessageToExtension } from '../types';

  interface Props {
    initialConfig?: SetupConfig;
    onSave: (config: SetupConfig, gitToken?: string, jiraToken?: string) => void;
    onSkip: () => void;
    onTestJira: (baseUrl: string, email: string, token: string) => void;
    onTestGit: (provider: GitProvider, baseUrl: string, org: string, token: string) => void;
    onOpenExternal: (url: string) => void;
    onBrowseFolder: () => void;
  }

  let {
    initialConfig,
    onSave,
    onSkip,
    onTestJira,
    onTestGit,
    onOpenExternal,
    onBrowseFolder,
  }: Props = $props();

  // Form state
  let workspaceDir = $state(initialConfig?.workspaceDir || '~/grove-workspaces');
  let branchTemplate = $state(initialConfig?.branchTemplate || '{ticketId}-{slug}');

  // Git provider state
  let gitEnabled = $state(!!initialConfig?.git);
  let gitProvider = $state<GitProvider>(initialConfig?.git?.provider || 'github');
  let gitBaseUrl = $state(initialConfig?.git?.baseUrl || 'https://github.com');
  let gitOrg = $state(initialConfig?.git?.org || '');
  let gitToken = $state('');
  let gitTokenVisible = $state(false);
  let gitTestStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let gitTestError = $state('');

  // Jira state
  let jiraEnabled = $state(!!initialConfig?.jira);
  let jiraBaseUrl = $state(initialConfig?.jira?.baseUrl || '');
  let jiraEmail = $state(initialConfig?.jira?.email || '');
  let jiraToken = $state('');
  let jiraTokenVisible = $state(false);
  let jiraTestStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
  let jiraTestError = $state('');

  // Saving state
  let saving = $state(false);

  // Update git base URL when provider changes
  $effect(() => {
    if (gitProvider === 'github') {
      gitBaseUrl = 'https://github.com';
    } else if (gitProvider === 'gitlab') {
      gitBaseUrl = 'https://gitlab.com';
    } else {
      gitBaseUrl = 'https://bitbucket.org';
    }
  });

  // Helper URLs
  const tokenUrls: Record<GitProvider, string> = {
    github: 'https://github.com/settings/tokens/new?scopes=repo&description=Grove%20VS%20Code',
    gitlab: 'https://gitlab.com/-/user_settings/personal_access_tokens',
    bitbucket: 'https://bitbucket.org/account/settings/app-passwords/',
  };

  const jiraTokenUrl = 'https://id.atlassian.com/manage-profile/security/api-tokens';

  function handleTestGit() {
    if (!gitOrg || !gitToken) return;
    gitTestStatus = 'testing';
    gitTestError = '';
    onTestGit(gitProvider, gitBaseUrl, gitOrg, gitToken);
  }

  function handleTestJira() {
    if (!jiraBaseUrl || !jiraEmail || !jiraToken) return;
    jiraTestStatus = 'testing';
    jiraTestError = '';
    onTestJira(jiraBaseUrl, jiraEmail, jiraToken);
  }

  function handleSave() {
    saving = true;
    const config: SetupConfig = {
      workspaceDir,
      branchTemplate,
    };

    if (gitEnabled && gitOrg) {
      config.git = {
        provider: gitProvider,
        baseUrl: gitBaseUrl,
        org: gitOrg,
      };
    }

    if (jiraEnabled && jiraBaseUrl && jiraEmail) {
      config.jira = {
        baseUrl: jiraBaseUrl,
        email: jiraEmail,
      };
    }

    onSave(
      config,
      gitEnabled && gitToken ? gitToken : undefined,
      jiraEnabled && jiraToken ? jiraToken : undefined
    );
  }

  // Expose methods for parent to call when test results come back
  export function setGitTestResult(result: ConnectionTestResult) {
    gitTestStatus = result.success ? 'success' : 'error';
    gitTestError = result.error || '';
  }

  export function setJiraTestResult(result: ConnectionTestResult) {
    jiraTestStatus = result.success ? 'success' : 'error';
    jiraTestError = result.error || '';
  }

  export function setSaving(value: boolean) {
    saving = value;
  }

  export function setWorkspaceDir(path: string) {
    workspaceDir = path;
  }
</script>

<div class="setup-form">
  <header class="setup-header">
    <div class="logo">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="var(--grove-green)" opacity="0.2"/>
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="var(--grove-green)" stroke-width="1.5" fill="none"/>
        <path d="M12 6v12M8 8l4 2 4-2M8 12l4 2 4-2" stroke="var(--grove-green)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
    <h1>Welcome to Grove</h1>
    <p class="subtitle">Let's set up your workspace</p>
  </header>

  <div class="form-sections">
    <!-- Workspace Section -->
    <section class="form-section">
      <div class="section-header">
        <h2>Workspace</h2>
        <span class="badge badge-required">Required</span>
      </div>

      <div class="form-group">
        <label for="workspaceDir">Workspace Directory</label>
        <div class="input-with-button">
          <input
            type="text"
            id="workspaceDir"
            bind:value={workspaceDir}
            placeholder="~/grove-workspaces"
          />
          <button type="button" class="btn-secondary" onclick={onBrowseFolder}>
            Browse
          </button>
        </div>
        <span class="help-text">Where Grove creates task workspaces</span>
      </div>

      <div class="form-group">
        <label for="branchTemplate">Branch Template</label>
        <input
          type="text"
          id="branchTemplate"
          bind:value={branchTemplate}
          placeholder="{ticketId}-{slug}"
        />
        <span class="help-text">Use {'{ticketId}'} and {'{slug}'} as placeholders</span>
      </div>
    </section>

    <!-- Git Provider Section -->
    <section class="form-section">
      <div class="section-header">
        <h2>Git Provider</h2>
        <label class="toggle">
          <input type="checkbox" bind:checked={gitEnabled} />
          <span class="toggle-label">{gitEnabled ? 'Enabled' : 'Optional'}</span>
        </label>
      </div>

      {#if gitEnabled}
        <div class="form-content">
          <div class="form-group">
            <label>Provider</label>
            <div class="provider-buttons">
              <button
                type="button"
                class="provider-btn"
                class:active={gitProvider === 'github'}
                onclick={() => (gitProvider = 'github')}
              >
                GitHub
              </button>
              <button
                type="button"
                class="provider-btn"
                class:active={gitProvider === 'gitlab'}
                onclick={() => (gitProvider = 'gitlab')}
              >
                GitLab
              </button>
              <button
                type="button"
                class="provider-btn"
                class:active={gitProvider === 'bitbucket'}
                onclick={() => (gitProvider = 'bitbucket')}
              >
                Bitbucket
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="gitBaseUrl">Base URL</label>
            <input
              type="text"
              id="gitBaseUrl"
              bind:value={gitBaseUrl}
              placeholder="https://github.com"
            />
            <span class="help-text">Change for self-hosted instances</span>
          </div>

          <div class="form-group">
            <label for="gitOrg">Organization</label>
            <input
              type="text"
              id="gitOrg"
              bind:value={gitOrg}
              placeholder="my-org"
            />
          </div>

          <div class="form-group">
            <label for="gitToken">
              {gitProvider === 'github' ? 'Personal Access Token' :
               gitProvider === 'gitlab' ? 'Personal Access Token' : 'App Password'}
            </label>
            <div class="input-with-button">
              {#if gitTokenVisible}
                <input
                  type="text"
                  id="gitToken"
                  bind:value={gitToken}
                  placeholder="ghp_xxxxxxxxxxxx"
                />
              {:else}
                <input
                  type="password"
                  id="gitToken"
                  bind:value={gitToken}
                  placeholder="ghp_xxxxxxxxxxxx"
                />
              {/if}
              <button
                type="button"
                class="btn-icon"
                onclick={() => (gitTokenVisible = !gitTokenVisible)}
                title={gitTokenVisible ? 'Hide token' : 'Show token'}
              >
                {gitTokenVisible ? '🙈' : '👁'}
              </button>
            </div>
            <button
              type="button"
              class="link-button"
              onclick={() => onOpenExternal(tokenUrls[gitProvider])}
            >
              Generate a {gitProvider === 'github' ? 'GitHub PAT' : gitProvider === 'gitlab' ? 'GitLab token' : 'Bitbucket app password'} →
            </button>
          </div>

          <div class="test-connection">
            <button
              type="button"
              class="btn-secondary"
              onclick={handleTestGit}
              disabled={!gitOrg || !gitToken || gitTestStatus === 'testing'}
            >
              {gitTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {#if gitTestStatus === 'success'}
              <span class="test-result success">✓ Connected</span>
            {:else if gitTestStatus === 'error'}
              <span class="test-result error">✗ {gitTestError || 'Connection failed'}</span>
            {/if}
          </div>
        </div>
      {/if}
    </section>

    <!-- Jira Section -->
    <section class="form-section">
      <div class="section-header">
        <h2>Jira</h2>
        <label class="toggle">
          <input type="checkbox" bind:checked={jiraEnabled} />
          <span class="toggle-label">{jiraEnabled ? 'Enabled' : 'Optional'}</span>
        </label>
      </div>

      {#if jiraEnabled}
        <div class="form-content">
          <div class="form-group">
            <label for="jiraBaseUrl">Jira URL</label>
            <input
              type="text"
              id="jiraBaseUrl"
              bind:value={jiraBaseUrl}
              placeholder="https://company.atlassian.net"
            />
          </div>

          <div class="form-group">
            <label for="jiraEmail">Email</label>
            <input
              type="email"
              id="jiraEmail"
              bind:value={jiraEmail}
              placeholder="you@company.com"
            />
          </div>

          <div class="form-group">
            <label for="jiraToken">API Token</label>
            <div class="input-with-button">
              {#if jiraTokenVisible}
                <input
                  type="text"
                  id="jiraToken"
                  bind:value={jiraToken}
                  placeholder="Your Jira API token"
                />
              {:else}
                <input
                  type="password"
                  id="jiraToken"
                  bind:value={jiraToken}
                  placeholder="Your Jira API token"
                />
              {/if}
              <button
                type="button"
                class="btn-icon"
                onclick={() => (jiraTokenVisible = !jiraTokenVisible)}
                title={jiraTokenVisible ? 'Hide token' : 'Show token'}
              >
                {jiraTokenVisible ? '🙈' : '👁'}
              </button>
            </div>
            <button
              type="button"
              class="link-button"
              onclick={() => onOpenExternal(jiraTokenUrl)}
            >
              Create Jira API token →
            </button>
          </div>

          <div class="test-connection">
            <button
              type="button"
              class="btn-secondary"
              onclick={handleTestJira}
              disabled={!jiraBaseUrl || !jiraEmail || !jiraToken || jiraTestStatus === 'testing'}
            >
              {jiraTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {#if jiraTestStatus === 'success'}
              <span class="test-result success">✓ Connected</span>
            {:else if jiraTestStatus === 'error'}
              <span class="test-result error">✗ {jiraTestError || 'Connection failed'}</span>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  </div>

  <footer class="setup-footer">
    <button type="button" class="btn-ghost" onclick={onSkip}>
      Skip for Now
    </button>
    <button
      type="button"
      class="btn-primary"
      onclick={handleSave}
      disabled={saving || !workspaceDir}
    >
      {saving ? 'Saving...' : 'Save & Start'}
    </button>
  </footer>
</div>

<style>
  .setup-form {
    max-width: 600px;
    margin: 0 auto;
  }

  .setup-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .logo {
    margin-bottom: 16px;
  }

  .setup-header h1 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .subtitle {
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
  }

  .form-sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-section {
    background-color: var(--vscode-input-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    padding: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .section-header h2 {
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-foreground);
  }

  .badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .badge-required {
    background-color: rgba(74, 222, 128, 0.15);
    color: var(--grove-green);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .toggle-label {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }

  .form-content {
    animation: fadeIn 0.2s ease-out;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--vscode-foreground);
  }

  .form-group input[type="text"],
  .form-group input[type="email"],
  .form-group input[type="password"] {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    background-color: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 4px;
    color: var(--vscode-input-foreground);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .form-group input::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }

  .input-with-button {
    display: flex;
    gap: 8px;
  }

  .input-with-button input {
    flex: 1;
  }

  .help-text {
    display: block;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
  }

  .link-button {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
    padding: 0;
    margin-top: 4px;
    cursor: pointer;
    text-align: left;
  }

  .link-button:hover {
    color: var(--vscode-textLink-activeForeground);
    text-decoration: underline;
  }

  .provider-buttons {
    display: flex;
    gap: 8px;
  }

  .provider-btn {
    flex: 1;
    padding: 8px 12px;
    font-size: 13px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .provider-btn:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }

  .provider-btn.active {
    background-color: var(--grove-green);
    color: #000;
    border-color: var(--grove-green);
  }

  .test-connection {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--vscode-panel-border);
  }

  .test-result {
    font-size: 13px;
    font-weight: 500;
  }

  .test-result.success {
    color: var(--vscode-testing-iconPassed);
  }

  .test-result.error {
    color: var(--vscode-testing-iconFailed);
  }

  .setup-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--vscode-panel-border);
  }

  .btn-primary {
    background-color: var(--grove-green);
    color: #000;
    font-weight: 500;
    padding: 10px 24px;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--grove-green-dark);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    padding: 8px 16px;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }

  .btn-ghost {
    background: transparent;
    color: var(--vscode-descriptionForeground);
    padding: 10px 24px;
  }

  .btn-ghost:hover {
    color: var(--vscode-foreground);
    background-color: var(--vscode-toolbar-hoverBackground);
  }

  .btn-icon {
    padding: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
