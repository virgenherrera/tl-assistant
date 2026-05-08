import { config as loadDotenv } from 'dotenv';

let loaded = false;

export function loadAppEnvFiles(): void {
  if (loaded) return;

  loadDotenv({ path: '.env.local', quiet: true });
  loadDotenv({ path: '.env', quiet: true });
  loaded = true;
}
