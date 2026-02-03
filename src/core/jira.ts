/**
 * Jira API client for Grove
 */

import { JiraTicket, OperationResult } from './types';

/**
 * Jira API response types
 */
interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
  };
}

/**
 * Jira client configuration
 */
export interface JiraClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

/**
 * Jira API client
 */
export class JiraClient {
  private baseUrl: string;
  private email: string;
  private apiToken: string;

  constructor(config: JiraClientConfig) {
    // Remove trailing slash from base URL
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.email = config.email;
    this.apiToken = config.apiToken;
  }

  /**
   * Get the authorization header for Jira API
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make an authenticated request to the Jira API
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    headers.set('Authorization', this.getAuthHeader());
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Get a Jira ticket by ID/key
   */
  async getTicket(ticketId: string): Promise<OperationResult<JiraTicket>> {
    try {
      const response = await this.fetch(`/rest/api/3/issue/${ticketId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: `Ticket "${ticketId}" not found`,
          };
        }
        if (response.status === 401) {
          return {
            success: false,
            error: 'Jira authentication failed. Please check your credentials.',
          };
        }
        return {
          success: false,
          error: `Failed to fetch ticket: ${response.status} ${response.statusText}`,
        };
      }

      const data = (await response.json()) as JiraIssueResponse;

      const ticket: JiraTicket = {
        id: data.id,
        key: data.key,
        summary: data.fields.summary,
        status: data.fields.status.name,
        url: `${this.baseUrl}/browse/${data.key}`,
      };

      return { success: true, data: ticket };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch ticket: ${error}`,
      };
    }
  }

  /**
   * Get multiple Jira tickets
   */
  async getTickets(ticketIds: string[]): Promise<OperationResult<JiraTicket[]>> {
    const tickets: JiraTicket[] = [];
    const errors: string[] = [];

    for (const ticketId of ticketIds) {
      const result = await this.getTicket(ticketId);
      if (result.success && result.data) {
        tickets.push(result.data);
      } else {
        errors.push(`${ticketId}: ${result.error}`);
      }
    }

    if (errors.length > 0 && tickets.length === 0) {
      return {
        success: false,
        error: `Failed to fetch all tickets: ${errors.join(', ')}`,
      };
    }

    return { success: true, data: tickets };
  }

  /**
   * Search for tickets using JQL
   */
  async searchTickets(jql: string, maxResults: number = 50): Promise<OperationResult<JiraTicket[]>> {
    try {
      const response = await this.fetch(
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Search failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = (await response.json()) as { issues: JiraIssueResponse[] };

      const tickets: JiraTicket[] = data.issues.map((issue) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        url: `${this.baseUrl}/browse/${issue.key}`,
      }));

      return { success: true, data: tickets };
    } catch (error) {
      return {
        success: false,
        error: `Search failed: ${error}`,
      };
    }
  }

  /**
   * Test the connection to Jira
   */
  async testConnection(): Promise<OperationResult<boolean>> {
    try {
      const response = await this.fetch('/rest/api/3/myself');

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Authentication failed. Please check your email and API token.',
          };
        }
        return {
          success: false,
          error: `Connection test failed: ${response.status} ${response.statusText}`,
        };
      }

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: `Connection test failed: ${error}`,
      };
    }
  }

  /**
   * Get the browse URL for a ticket
   */
  getTicketUrl(ticketKey: string): string {
    return `${this.baseUrl}/browse/${ticketKey}`;
  }
}

/**
 * Create a Jira client instance
 */
export function createJiraClient(config: JiraClientConfig): JiraClient {
  return new JiraClient(config);
}
