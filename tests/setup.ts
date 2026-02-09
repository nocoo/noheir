import { beforeAll } from 'bun:test';
import { Window } from 'happy-dom';

beforeAll(() => {
  // SAFETY: Force-override to dummy values so unit tests NEVER leak to
  // a real Supabase instance, even if .env.local contains production credentials.
  // Bun auto-loads .env.local before preload scripts, so `||` is NOT safe here.
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
