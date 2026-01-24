import type { RemoveIndex } from './remove-keys.js';

export type KnownKeys<T> = keyof RemoveIndex<T>;
