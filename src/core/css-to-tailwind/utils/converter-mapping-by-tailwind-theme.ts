import type { Config } from 'tailwindcss';
import type {
  KeyValuePair,
  RecursiveKeyValuePair,
  ScreensConfig,
} from 'tailwindcss/types/config';
import type { ConverterMapping } from '../types/converter-mapping.js';

import { colord } from 'colord';
import { buildMediaQueryByScreen } from './build-media-query-by-screen.js';
import { flattenObject } from './flatten-object.js';
import { remValueToPx } from './rem-value-to-px.js';
import { normalizeNumbersInString } from './normalize-numbers-in-string.js';
import { removeUnnecessarySpaces } from './remove-unnecessary-spaces.js';

export function normalizeValue(value: string) {
  return removeUnnecessarySpaces(normalizeNumbersInString(value));
}

export function normalizeColorValue(colorValue: string) {
  const parsed = colord(colorValue);

  return parsed.isValid() ? parsed.toHex() : colorValue;
}

export function normalizeZeroSizeValue(value: string) {
  return value.trim() === '0px' ? '0' : value;
}

export function normalizeSizeValue(
  sizeValue: string,
  remInPx: number | undefined | null
) {
  return normalizeZeroSizeValue(
    normalizeNumbersInString(
      remInPx != null ? remValueToPx(sizeValue, remInPx) : sizeValue
    )
  );
}

export function normalizeAtRuleParams(atRuleParam: string) {
  return removeUnnecessarySpaces(atRuleParam.replace(/\(|\)/g, ''));
}

function mapThemeTokens<V>(
  tokens: KeyValuePair<string, V>,
  valueConverterFn: (tokenValue: V, tokenKey: string) => string | null
) {
  const result: Record<string, string> = {};

  Object.keys(tokens).forEach(tokenKey => {
    const tokenValue = tokens[tokenKey] as V;
    const convertedTokenValue = valueConverterFn(tokenValue, tokenKey);

    if (convertedTokenValue) {
      result[convertedTokenValue] = tokenKey;
    }
  });

  return result;
}

function isColorKey(key: string) {
  return (
    ['fill', 'stroke'].includes(key) || key.toLowerCase().includes('color')
  );
}

function isSizeKey(key: string) {
  return [
    'backdropBlur',
    'backgroundSize',
    'blur',
    'borderRadius',
    'borderSpacing',
    'borderWidth',
    'columns',
    'divideWidth',
    'flexBasis',
    'gap',
    'height',
    'inset',
    'letterSpacing',
    'lineHeight',
    'margin',
    'maxHeight',
    'maxWidth',
    'minHeight',
    'minWidth',
    'outlineOffset',
    'outlineWidth',
    'padding',
    'ringOffsetWidth',
    'ringWidth',
    'scrollMargin',
    'scrollPadding',
    'space',
    'spacing',
    'strokeWidth',
    'textDecorationThickness',
    'textUnderlineOffset',
    'translate',
    'width',
  ].includes(key);
}

function convertFontSizes(
  fontSizes: KeyValuePair<
    string,
    | string
    | [fontSize: string, lineHeight: string]
    | [
        fontSize: string,
        configuration: Partial<{
          lineHeight: string;
          letterSpacing: string;
          fontWeight: string | number;
        }>
      ]
  >,
  remInPx?: number | null
) {
  return mapThemeTokens(fontSizes, fontSizeValue => {
    if (!fontSizeValue) {
      return null;
    }

    if (Array.isArray(fontSizeValue)) {
      fontSizeValue = fontSizeValue[0];
    }

    return normalizeSizeValue(fontSizeValue, remInPx);
  });
}

function convertScreens(screens: ScreensConfig) {
  if (Array.isArray(screens)) {
    return {} as Record<string, string>;
  }

  return mapThemeTokens(screens, screenValue => {
    return screenValue
      ? normalizeAtRuleParams(buildMediaQueryByScreen(screenValue))
      : null;
  });
}

function convertColors(colors: RecursiveKeyValuePair) {
  const flatColors = flattenObject(colors);

  return mapThemeTokens(flatColors, (colorValue: string) => {
    colorValue = colorValue?.toString();

    return colorValue ? normalizeColorValue(colorValue) : null;
  });
}

function convertSizes(sizes: KeyValuePair, remInPx: number | null | undefined) {
  return mapThemeTokens(sizes, (sizeValue: string) => {
    sizeValue = sizeValue?.toString();

    return sizeValue ? normalizeSizeValue(sizeValue, remInPx) : null;
  });
}

function convertOtherThemeTokens(tokens: KeyValuePair | null | undefined) {
  return tokens
    ? mapThemeTokens(tokens, (tokenValue: string) => {
        tokenValue = tokenValue?.toString();

        return tokenValue ? normalizeValue(tokenValue) : null;
      })
    : tokens;
}

export function converterMappingByTailwindTheme(
  resolvedTailwindTheme: Config['theme'],
  remInPx?: number | null
) {
  const converterMapping = {} as ConverterMapping;

  if (!resolvedTailwindTheme) {
    return converterMapping;
  }

  Object.keys(resolvedTailwindTheme as any).forEach(key => {
    if (['keyframes', 'container', 'fontFamily'].includes(key)) {
      return;
    }

    const themeItem = (resolvedTailwindTheme as any)[key];

    if (key === 'fontSize') {
      converterMapping[key] = convertFontSizes(themeItem, remInPx);
    } else if (key === 'screens') {
      converterMapping[key] = convertScreens(themeItem);
    } else if (isColorKey(key)) {
      (converterMapping as any)[key] = convertColors(themeItem);
    } else if (isSizeKey(key)) {
      (converterMapping as any)[key] = convertSizes(themeItem, remInPx);
    } else {
      (converterMapping as any)[key] = convertOtherThemeTokens(themeItem);
    }
  });

  return converterMapping;
}
