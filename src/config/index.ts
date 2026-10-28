import packageJson from '../../package.json';

// Note: Environment variables are loaded via dotenv-cli in package.json scripts.
// Next.js automatically loads .env files in the runtime, so no manual loading is needed here.

export type ConfigMap = Record<string, string>;

export const envConfigs: ConfigMap = {
  app_url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  app_name: process.env.NEXT_PUBLIC_APP_NAME ?? 'SOP2Workflow',
  app_description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
    'Turn ERP SOPs into n8n-ready automation workflows.',
  app_logo: process.env.NEXT_PUBLIC_APP_LOGO ?? '/logo.svg',
  app_favicon: process.env.NEXT_PUBLIC_APP_FAVICON ?? '/favicon.svg',
  app_preview_image:
    process.env.NEXT_PUBLIC_APP_PREVIEW_IMAGE ?? '/preview.png',
  theme: process.env.NEXT_PUBLIC_THEME ?? 'default',
  appearance: process.env.NEXT_PUBLIC_APPEARANCE ?? 'dark',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en',
  database_url: process.env.DATABASE_URL ?? '',
  database_auth_token: process.env.DATABASE_AUTH_TOKEN ?? '',
  database_provider: process.env.DATABASE_PROVIDER ?? 'postgresql',
  db_schema_file: process.env.DB_SCHEMA_FILE ?? './src/config/db/schema.ts',
  // PostgreSQL schema name (e.g. 'web'). Default: 'public'
  db_schema: process.env.DB_SCHEMA ?? 'public',
  // Drizzle migrations journal table name (avoid conflicts across projects)
  db_migrations_table:
    process.env.DB_MIGRATIONS_TABLE ?? '__drizzle_migrations',
  // Drizzle migrations journal schema (default in drizzle-kit is 'drizzle')
  // We keep 'public' as template default for stability on fresh Supabase DBs.
  db_migrations_schema: process.env.DB_MIGRATIONS_SCHEMA ?? 'drizzle',
  // Output folder for drizzle-kit generated migrations
  db_migrations_out:
    process.env.DB_MIGRATIONS_OUT ?? './src/config/db/migrations',
  db_singleton_enabled: process.env.DB_SINGLETON_ENABLED || 'false',
  db_max_connections: process.env.DB_MAX_CONNECTIONS || '1',
  auth_url: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '',
  auth_secret: process.env.AUTH_SECRET ?? '', // openssl rand -base64 32
  evolink_api_url:
    process.env.EVOLINK_API_URL ??
    'https://direct.evolink.ai/v1/chat/completions',
  evolink_model: process.env.EVOLINK_MODEL ?? 'gemini-3.8-flash',
  sop_workflow_rate_salt:
    process.env.SOP_WORKFLOW_RATE_SALT ?? process.env.AUTH_SECRET ?? '',
  version: packageJson.version,
  locale_detect_enabled:
    process.env.NEXT_PUBLIC_LOCALE_DETECT_ENABLED ?? 'false',
};
