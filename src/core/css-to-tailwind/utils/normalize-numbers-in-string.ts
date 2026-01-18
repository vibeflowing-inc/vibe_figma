export function normalizeNumbersInString(string: string) {
  return string.replace(/(^|[,;+-/*\s])(\.\d+)/g, '$10$2');
}
