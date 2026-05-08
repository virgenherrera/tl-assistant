import { z } from 'zod';

const jiraAuthModes = ['basic'] as const;
const jiraEnvKeys = ['JIRA_SITE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_BOARD_ID', 'JIRA_CLOUD_ID', 'JIRA_AUTH_MODE'] as const;

const jiraRawEnvSchema = z.object({
  JIRA_SITE_URL: z.string().trim().url('JIRA_SITE_URL must be a valid URL.').optional(),
  JIRA_EMAIL: z.string().trim().email('JIRA_EMAIL must be a valid email.').optional(),
  JIRA_API_TOKEN: z.string().trim().min(1, 'JIRA_API_TOKEN cannot be empty.').optional(),
  JIRA_BOARD_ID: z.coerce.number().int().positive('JIRA_BOARD_ID must be a positive integer.').optional(),
  JIRA_CLOUD_ID: z.string().trim().min(1, 'JIRA_CLOUD_ID cannot be empty.').optional(),
  JIRA_AUTH_MODE: z.enum(jiraAuthModes).optional(),
});

export class JiraConfig {
  readonly configured!: boolean;
  readonly siteUrl?: string;
  readonly email?: string;
  readonly apiToken?: string;
  readonly boardId?: number;
  readonly cloudId?: string;
  readonly authMode!: 'basic';
  readonly apiBaseUrl?: string;

  static readonly schema = jiraRawEnvSchema
    .superRefine((value, context) => {
      const hasAnyJiraValue = jiraEnvKeys.some((key) => value[key] !== undefined);
      if (!hasAnyJiraValue) return;

      for (const key of ['JIRA_SITE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_BOARD_ID'] as const) {
        if (value[key] === undefined) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when Jira integration is configured.`,
          });
        }
      }
    })
    .transform((value) => {
      const configured = Boolean(value.JIRA_SITE_URL && value.JIRA_EMAIL && value.JIRA_API_TOKEN && value.JIRA_BOARD_ID);
      const siteUrl = value.JIRA_SITE_URL?.replace(/\/$/, '');
      const apiBaseUrl = configured
        ? value.JIRA_CLOUD_ID
          ? `https://api.atlassian.com/ex/jira/${value.JIRA_CLOUD_ID}`
          : siteUrl
        : undefined;

      return {
        configured,
        ...(siteUrl === undefined ? {} : { siteUrl }),
        ...(value.JIRA_EMAIL === undefined ? {} : { email: value.JIRA_EMAIL }),
        ...(value.JIRA_API_TOKEN === undefined ? {} : { apiToken: value.JIRA_API_TOKEN }),
        ...(value.JIRA_BOARD_ID === undefined ? {} : { boardId: value.JIRA_BOARD_ID }),
        ...(value.JIRA_CLOUD_ID === undefined ? {} : { cloudId: value.JIRA_CLOUD_ID }),
        authMode: value.JIRA_AUTH_MODE ?? 'basic',
        ...(apiBaseUrl === undefined ? {} : { apiBaseUrl: apiBaseUrl.replace(/\/$/, '') }),
      } satisfies JiraConfig;
    });

  static isConfiguredEnv(sourceEnv: NodeJS.ProcessEnv): boolean {
    const result = jiraRawEnvSchema.safeParse(sourceEnv);
    return result.success && Boolean(result.data.JIRA_SITE_URL && result.data.JIRA_EMAIL && result.data.JIRA_API_TOKEN && result.data.JIRA_BOARD_ID);
  }
}
