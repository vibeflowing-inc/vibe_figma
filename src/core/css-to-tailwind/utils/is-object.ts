export function isObject(value: any): value is Record<keyof any, any> {
  return value && typeof value === 'object' && !Array.isArray(value);
}
