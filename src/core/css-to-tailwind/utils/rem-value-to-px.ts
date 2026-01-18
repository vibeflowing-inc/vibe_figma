const remValueRegexp = /^(\d+)?\.?\d+rem$/;

export function remValueToPx(value: string, remInPx: number) {
  if (remValueRegexp.test(value.trim())) {
    const number = parseFloat(value);

    return isNaN(number) ? value : `${number * remInPx}px`;
  }

  return value;
}
