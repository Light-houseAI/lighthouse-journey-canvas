/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog host URL (defaults to https://us.i.posthog.com) */
  readonly VITE_POSTHOG_HOST?: string;
  /** API base URL for backend */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
