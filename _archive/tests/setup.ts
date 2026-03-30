import { beforeAll } from 'bun:test';
import { Window } from 'happy-dom';

beforeAll(() => {
  // SAFETY: Two-layer defense against production DB leaks:
  // 1. .env.test provides safe dummy values (Bun skips .env.local when NODE_ENV=test)
  // 2. This force-override catches edge cases (e.g., explicit --env-file overrides)
  process.env.VITE_SUPABASE_URL = 'http://localhost';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

  if (typeof document !== 'undefined') {
    return;
  }

  const windowInstance = new Window();
  (globalThis as unknown as { window?: Window }).window = windowInstance;
  (globalThis as unknown as { document?: Document }).document = windowInstance.document as unknown as Document;
  (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser = windowInstance.DOMParser as unknown as typeof DOMParser;
  (globalThis as unknown as { location?: Location }).location = windowInstance.location as unknown as Location;
  (globalThis as unknown as { localStorage?: Storage }).localStorage = windowInstance.localStorage as unknown as Storage;
});
