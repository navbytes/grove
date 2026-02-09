import { loadConfig } from './config.js';
import { getToken } from './secrets.js';
import type { OperationResult } from './types.js';

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  issueType: string;
}

export interface JiraAuth {
  baseUrl: string;
  email: string;
  token: string;
}

export async function getJiraAuth(): Promise<JiraAuth | null> {
  const config = await loadConfig();
  if (!config.jira?.baseUrl || !config.jira?.email) {
    return null;
  }

  const token = await getToken('GROVE_JIRA_TOKEN', 'jira-api-token');
  if (!token) {
    return null;
  }

  return { baseUrl: config.jira.baseUrl, email: config.jira.email, token };
}

export async function isJiraConfigured(): Promise<boolean> {
  const auth = await getJiraAuth();
  return auth !== null;
}

export async function fetchJiraIssueWithAuth(issueKey: string, auth: JiraAuth): Promise<OperationResult<JiraIssue>> {
  const url = `${auth.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,issuetype`;
  const credentials = Buffer.from(`${auth.email}:${auth.token}`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Jira authentication failed. Check your credentials with `grove init`.' };
      }
      if (response.status === 404) {
        return { success: false, error: `Jira issue "${issueKey}" not found.` };
      }
      return { success: false, error: `Jira API error: ${response.status} ${response.statusText}` };
    }

    const data = (await response.json()) as {
      key: string;
      fields: {
        summary: string;
        status: { name: string };
        issuetype: { name: string };
      };
    };

    return {
      success: true,
      data: {
        key: data.key,
        summary: data.fields.summary,
        status: data.fields.status.name,
        issueType: data.fields.issuetype.name,
      },
    };
  } catch (err) {
    if (err instanceof TypeError && String(err.message).includes('fetch')) {
      return { success: false, error: 'Could not connect to Jira. Check your network and base URL.' };
    }
    return { success: false, error: `Jira request failed: ${err}` };
  }
}

export async function fetchJiraIssue(issueKey: string): Promise<OperationResult<JiraIssue>> {
  const auth = await getJiraAuth();
  if (!auth) {
    return { success: false, error: 'Jira is not configured. Run `grove init` to set up Jira integration.' };
  }
  return fetchJiraIssueWithAuth(issueKey, auth);
}

export async function fetchMultipleJiraIssues(issueKeys: string[]): Promise<Map<string, JiraIssue>> {
  const auth = await getJiraAuth();
  if (!auth) {
    return new Map();
  }

  const results = new Map<string, JiraIssue>();
  for (const key of issueKeys) {
    const result = await fetchJiraIssueWithAuth(key, auth);
    if (result.success && result.data) {
      results.set(key, result.data);
    }
  }

  return results;
}
