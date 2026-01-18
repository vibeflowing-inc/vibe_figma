import type { RemoveIndex } from './remove-keys';

export type KnownKeys<T> = keyof RemoveIndex<T>;
