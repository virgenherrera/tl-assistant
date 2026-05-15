import { z } from 'zod';

const confluenceAuthModes = ['basic'] as const;
const confluenceEnvKeys = [
  'CONFLUENCE_SITE_URL',
  'CONFLUENCE_EMAIL',
  'CONFLUENCE_API_TOKEN',
  'CONFLUENCE_SPACE_KEY',
  'CONFLUENCE_AUTH_MODE',
] as const;

const optionalEnvString = <T extends z.ZodType>(schema: T) => z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, schema.optional());

const confluenceRawEnvSchema = z.object({
  CONFLUENCE_SITE_URL: optionalEnvString(z.string().url('CONFLUENCE_SITE_URL must be a valid URL.')),
  CONFLUENCE_EMAIL: optionalEnvString(z.string().email('CONFLUENCE_EMAIL must be a valid email.')),
  CONFLUENCE_API_TOKEN: optionalEnvString(z.string().min(1, 'CONFLUENCE_API_TOKEN cannot be empty.')),
  CONFLUENCE_SPACE_KEY: optionalEnvString(z.string().min(1, 'CONFLUENCE_SPACE_KEY cannot be empty.')),
  CONFLUENCE_AUTH_MODE: optionalEnvString(z.enum(confluenceAuthModes)),
  JIRA_SITE_URL: optionalEnvString(z.string().url()),
  JIRA_EMAIL: optionalEnvString(z.string().email()),
  JIRA_API_TOKEN: optionalEnvString(z.string().min(1)),
});

export class ConfluenceConfig {
  readonly configured!: boolean;
  readonly siteUrl?: string;
  readonly email?: string;
  readonly apiToken?: string;
  readonly spaceKey?: string;
  readonly authMode!: 'basic';
  readonly apiBaseUrl?: string;

  static readonly schema = confluenceRawEnvSchema
    .superRefine((value, context) => {
      const hasExplicitConfluenceValue = confluenceEnvKeys.some((key) => value[key] !== undefined);
      if (!hasExplicitConfluenceValue) return;

      for (const key of ['CONFLUENCE_SITE_URL', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN'] as const) {
        if (value[key] === undefined) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when Confluence integration is explicitly configured.`,
          });
        }
      }
    })
    .transform((value) => {
      const siteUrl = (value.CONFLUENCE_SITE_URL ?? value.JIRA_SITE_URL)?.replace(/\/$/, '');
      const email = value.CONFLUENCE_EMAIL ?? value.JIRA_EMAIL;
      const apiToken = value.CONFLUENCE_API_TOKEN ?? value.JIRA_API_TOKEN;
      const configured = Boolean(siteUrl && email && apiToken);
      const apiBaseUrl = configured ? `${siteUrl}/wiki` : undefined;

      return {
        configured,
        ...(siteUrl === undefined ? {} : { siteUrl }),
        ...(email === undefined ? {} : { email }),
        ...(apiToken === undefined ? {} : { apiToken }),
        ...(value.CONFLUENCE_SPACE_KEY === undefined ? {} : { spaceKey: value.CONFLUENCE_SPACE_KEY }),
        authMode: value.CONFLUENCE_AUTH_MODE ?? 'basic',
        ...(apiBaseUrl === undefined ? {} : { apiBaseUrl }),
      } satisfies ConfluenceConfig;
    });

  static isConfiguredEnv(sourceEnv: NodeJS.ProcessEnv): boolean {
    const result = confluenceRawEnvSchema.safeParse(sourceEnv);
    if (!result.success) return false;
    const siteUrl = result.data.CONFLUENCE_SITE_URL ?? result.data.JIRA_SITE_URL;
    const email = result.data.CONFLUENCE_EMAIL ?? result.data.JIRA_EMAIL;
    const apiToken = result.data.CONFLUENCE_API_TOKEN ?? result.data.JIRA_API_TOKEN;
    return Boolean(siteUrl && email && apiToken);
  }
}
