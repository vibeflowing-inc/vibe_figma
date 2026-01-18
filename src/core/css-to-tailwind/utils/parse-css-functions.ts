import { parseCSSFunction } from './parse-css-function';

const cssFunctionRegexp = /([\w-]+)\((.*?)\)/gm;

export function parseCSSFunctions(value: string) {
  return (
    value
      .trim()
      .match(cssFunctionRegexp)
      ?.map((cssFunction: string) => {
        return parseCSSFunction(cssFunction);
      }) || []
  );
}
