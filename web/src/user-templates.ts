// Templates the user brought in themselves, kept beside the built-ins rather than replacing them.
// Storage is injectable because bun has no localStorage, and an untested store loses documents.

const PREFIX = "typstmd:user-template:";

export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore {
  return localStorage;
}

/** Sorted, so the picker order does not depend on insertion order. */
export function listUserTemplates(store: KeyValueStore = defaultStore()): string[] {
  const names: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(PREFIX)) names.push(key.slice(PREFIX.length));
  }
  return names.sort((a, b) => a.localeCompare(b));
}

export function getUserTemplate(name: string, store: KeyValueStore = defaultStore()): string | null {
  return store.getItem(PREFIX + name);
}

export function hasUserTemplate(name: string, store: KeyValueStore = defaultStore()): boolean {
  return store.getItem(PREFIX + name) !== null;
}

export function saveUserTemplate(
  name: string,
  source: string,
  store: KeyValueStore = defaultStore(),
): void {
  store.setItem(PREFIX + name, source);
}

export function removeUserTemplate(name: string, store: KeyValueStore = defaultStore()): void {
  store.removeItem(PREFIX + name);
}
