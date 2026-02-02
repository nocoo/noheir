import { beforeAll } from 'bun:test';
import { Window } from 'happy-dom';

beforeAll(() => {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost';
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-key';

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
