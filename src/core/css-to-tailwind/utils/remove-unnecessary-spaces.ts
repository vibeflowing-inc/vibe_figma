export function removeUnnecessarySpaces(string: string) {
  return string.replace(/(\s+)?([,;:])(\s+)?/gm, '$2');
}
