const cssFunctionRegexp = /([\w-]+)\((.*?)\)/;

export function parseCSSFunction(string: string) {
  const match = string.match(cssFunctionRegexp);
  const name = match?.[1];
  const value = match?.[2];

  return { name: name || null, value: value || null };
}
