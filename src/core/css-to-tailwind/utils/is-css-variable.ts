export function isCSSVariable(value: string) {
  return /^var\((--.+?)\)$/.test(value.trim());
}
