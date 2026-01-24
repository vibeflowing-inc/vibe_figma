import type { Declaration } from 'postcss';
import type { ResolvedTailwindConverterConfig } from '../tailwind-converter.js';

import { UTILITIES_MAPPING } from './utilities-mapping.js';
import {
  normalizeColorValue,
  normalizeSizeValue,
  normalizeValue,
} from '../utils/converter-mapping-by-tailwind-theme.js';
import { parseCSSFunctions } from '../utils/parse-css-functions.js';
import { removeUnnecessarySpaces } from '../utils/remove-unnecessary-spaces.js';
import { isCSSVariable } from '../utils/is-css-variable.js';

export function prepareArbitraryValue(value: string) {
  return normalizeValue(value).replace(/_/g, '\\_').replace(/\s+/g, '_');
}

type CSSDataType =
  | 'color'
  | 'length'
  | 'number'
  | 'image'
  | 'position'
  | 'family-name';

export function convertDeclarationValue(
  value: string,
  valuesMap: Record<string, string>,
  classPrefix: string,
  fallbackValue = value,
  fallbackClassPrefix = classPrefix,
  cssDataType: CSSDataType | null = null
) {
  const normalizedValue = normalizeValue(value);
  const mappedValue = valuesMap[normalizedValue];
  if (mappedValue) {
    if (mappedValue === 'DEFAULT') {
      return [classPrefix];
    }

    return [`${classPrefix}-${mappedValue}`];
  }

  const arbitraryValue = prepareArbitraryValue(fallbackValue);

  if (!arbitraryValue) {
    return [];
  }

  if (cssDataType && isCSSVariable(arbitraryValue)) {
    return [
      `${fallbackClassPrefix}-[${
        cssDataType ? `${cssDataType}:` : ''
      }${arbitraryValue}]`,
    ];
  }

  return [`${fallbackClassPrefix}-[${arbitraryValue}]`];
}

export function strictConvertDeclarationValue(
  value: string,
  valuesMap: Record<string, string>
) {
  return valuesMap[value] ? [valuesMap[value]] : [];
}

function convertColorDeclarationValue(
  declValue: string,
  valuesMap: Record<string, string>,
  classPrefix: string,
  cssDataType: CSSDataType | null = null
) {
  return convertDeclarationValue(
    normalizeColorValue(declValue),
    valuesMap,
    classPrefix,
    declValue,
    classPrefix,
    cssDataType
  );
}

function convertSizeDeclarationValue(
  declValue: string,
  valuesMap: Record<string, string>,
  classPrefix: string,
  remInPx: number | null | undefined,
  supportsNegativeValues = false,
  cssDataType: CSSDataType | null = null
) {
  const normalizedValue = normalizeSizeValue(declValue, remInPx);
  const isNegativeValue =
    supportsNegativeValues && normalizedValue.startsWith('-');

  return convertDeclarationValue(
    isNegativeValue ? normalizedValue.substring(1) : normalizedValue,
    valuesMap,
    isNegativeValue ? `-${classPrefix}` : classPrefix,
    declValue,
    classPrefix,
    cssDataType
  );
}

function convertBorderDeclarationValue(
  value: string,
  config: ResolvedTailwindConverterConfig,
  classPrefix: string
) {
  const [width, style, ...colorArray] = value.split(/\s+/m);
  const color = colorArray.join(' ');

  let classes: string[] = [];

  if (width) {
    if (!config.tailwindConfig.corePlugins.borderWidth) {
      return [];
    }
    classes = classes.concat(
      convertSizeDeclarationValue(
        width,
        config.mapping.borderWidth,
        classPrefix,
        config.remInPx,
        false,
        'length'
      )
    );
  }

  if (style) {
    if (!config.tailwindConfig.corePlugins.borderStyle) {
      return [];
    }
    classes = classes.concat(
      strictConvertDeclarationValue(style, UTILITIES_MAPPING['border-style'])
    );
  }

  if (color) {
    if (!config.tailwindConfig.corePlugins.borderColor) {
      return [];
    }
    classes = classes.concat(
      convertColorDeclarationValue(
        color,
        config.mapping.borderColor,
        classPrefix,
        'color'
      )
    );
  }

  return classes;
}

function parseComposedSpacingValue(value: string) {
  const values = value.split(/\s+/m);

  if (values.length > 4) {
    return { top: null, right: null, bottom: null, left: null };
  }

  return {
    top: values[0],
    right: values[1] || values[0],
    bottom: values[2] || values[0],
    left: values[3] || values[1] || values[0],
  };
}

export function convertComposedSpacingDeclarationValue(
  value: string,
  mapping: {
    top: { valuesMapping: Record<string, string>; classPrefix: string };
    right: { valuesMapping: Record<string, string>; classPrefix: string };
    bottom: { valuesMapping: Record<string, string>; classPrefix: string };
    left: { valuesMapping: Record<string, string>; classPrefix: string };
  },
  remInPx: number | null | undefined
) {
  const parsed = parseComposedSpacingValue(value);
  let classes: string[] = [];

  (Object.keys(parsed) as ['top', 'right', 'bottom', 'left']).forEach(key => {
    const value = parsed[key];
    const { valuesMapping, classPrefix } = mapping[key] || {};

    if (value && valuesMapping && classPrefix) {
      classes = classes.concat(
        convertSizeDeclarationValue(
          value,
          valuesMapping,
          classPrefix,
          remInPx,
          true
        )
      );
    }
  });

  return classes;
}

type DeclarationConverter = (
  declaration: Declaration,
  config: ResolvedTailwindConverterConfig
) => string[];

interface DeclarationConvertersMapping {
  [property: string]: DeclarationConverter;
}

export const DECLARATION_CONVERTERS_MAPPING: DeclarationConvertersMapping = {
  'accent-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.accentColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.accentColor,
          'accent',
          'color'
        )
      : [],

  'align-content': (declaration, config) =>
    config.tailwindConfig.corePlugins.alignContent
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['align-content']
        )
      : [],

  'align-items': (declaration, config) =>
    config.tailwindConfig.corePlugins.alignItems
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['align-items']
        )
      : [],

  'align-self': (declaration, config) =>
    config.tailwindConfig.corePlugins.alignSelf
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['align-self']
        )
      : [],

  animation: (declaration, config) =>
    config.tailwindConfig.corePlugins.animation
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.animation,
          'animate'
        )
      : [],

  appearance: (declaration, config) =>
    config.tailwindConfig.corePlugins.appearance
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['appearance']
        )
      : [],

  'aspect-ratio': (declaration, config) =>
    config.tailwindConfig.corePlugins.aspectRatio
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.aspectRatio,
          'aspect'
        )
      : [],

  'backdrop-filter': (declaration, config) => {
    if (!config.tailwindConfig.corePlugins.backdropFilter) {
      return [];
    }

    let classes: string[] = [];
    const mappings: Record<string, any> = {
      blur:
        config.tailwindConfig.corePlugins.backdropBlur &&
        config.mapping.backdropBlur,
      brightness:
        config.tailwindConfig.corePlugins.backdropBrightness &&
        config.mapping.backdropBrightness,
      contrast:
        config.tailwindConfig.corePlugins.backdropContrast &&
        config.mapping.backdropContrast,
      grayscale:
        config.tailwindConfig.corePlugins.backdropGrayscale &&
        config.mapping.backdropGrayscale,
      'hue-rotate':
        config.tailwindConfig.corePlugins.backdropHueRotate &&
        config.mapping.backdropHueRotate,
      invert:
        config.tailwindConfig.corePlugins.backdropInvert &&
        config.mapping.backdropInvert,
      opacity:
        config.tailwindConfig.corePlugins.backdropOpacity &&
        config.mapping.backdropOpacity,
      saturate:
        config.tailwindConfig.corePlugins.backdropSaturate &&
        config.mapping.backdropSaturate,
      sepia:
        config.tailwindConfig.corePlugins.backdropSepia &&
        config.mapping.backdropSepia,
    };

    parseCSSFunctions(declaration.value).every(({ name, value }) => {
      if (name == null || value == null) {
        classes = [];
        return false;
      }

      const mapping = mappings[name];

      if (mapping) {
        delete mappings[name];

        const currentClasses = convertSizeDeclarationValue(
          value,
          mapping,
          `backdrop-${name}`,
          config.remInPx,
          name === 'hue-rotate'
        );

        if (currentClasses?.length) {
          classes = classes.concat(currentClasses);
          return true;
        }
      }

      classes = [];
      return false;
    });

    return classes;
  },

  'background-attachment': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundAttachment
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['background-attachment']
        )
      : [],

  'background-blend-mode': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundBlendMode
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['background-blend-mode']
        )
      : [],

  'background-clip': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundClip
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['background-clip']
        )
      : [],

  'background-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.backgroundColor,
          'bg',
          'color'
        )
      : [],

  'background-image': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundImage
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.backgroundImage,
          'bg',
          declaration.value,
          'bg',
          'image'
        )
      : [],

  'background-origin': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundOrigin
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['background-origin']
        )
      : [],

  'background-position': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundPosition
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.backgroundPosition,
          'bg',
          declaration.value,
          'bg',
          'position'
        )
      : [],

  'background-repeat': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundRepeat
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['background-repeat']
        )
      : [],

  'background-size': (declaration, config) =>
    config.tailwindConfig.corePlugins.backgroundSize
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.backgroundSize,
          'bg',
          config.remInPx,
          false,
          'length'
        )
      : [],

  border: (declaration, config) =>
    convertBorderDeclarationValue(declaration.value, config, 'border'),

  'border-bottom': (declaration, config) =>
    convertBorderDeclarationValue(declaration.value, config, 'border-b'),

  'border-bottom-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.borderColor,
          'border-b',
          'color'
        )
      : [],

  'border-bottom-left-radius': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderRadius
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderRadius,
          'rounded-bl',
          config.remInPx
        )
      : [],

  'border-bottom-right-radius': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderRadius
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderRadius,
          'rounded-br',
          config.remInPx
        )
      : [],

  // 'border-bottom-style': (declaration, config) =>
  //   strictConvertDeclarationValue(declaration.value, UTILITIES_MAPPING['border-style']),

  'border-bottom-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderWidth,
          'border-b',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'border-collapse': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderCollapse
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['border-collapse']
        )
      : [],

  'border-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.borderColor,
          'border',
          'color'
        )
      : [],

  'border-left': (declaration, config) =>
    convertBorderDeclarationValue(declaration.value, config, 'border-l'),

  'border-left-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.borderColor,
          'border-l',
          'color'
        )
      : [],

  // 'border-left-style': (declaration, config) =>
  //   strictConvertDeclarationValue(declaration.value, UTILITIES_MAPPING['border-style']),

  'border-left-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderWidth,
          'border-l',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'border-radius': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderRadius
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderRadius,
          'rounded',
          config.remInPx
        )
      : [],

  'border-right': (declaration, config) =>
    convertBorderDeclarationValue(declaration.value, config, 'border-r'),

  'border-right-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.borderColor,
          'border-r',
          'color'
        )
      : [],

  // 'border-right-style': (declaration, config) =>
  //   strictConvertDeclarationValue(declaration.value, UTILITIES_MAPPING['border-style']),

  'border-right-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderWidth,
          'border-r',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'border-spacing': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderSpacing
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderSpacing,
          'border-spacing',
          config.remInPx
        )
      : [],

  'border-style': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderStyle
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['border-style']
        )
      : [],

  'border-top': (declaration, config) =>
    convertBorderDeclarationValue(declaration.value, config, 'border-t'),

  'border-top-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.borderColor,
          'border-t',
          'color'
        )
      : [],

  'border-top-left-radius': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderRadius
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderRadius,
          'rounded-tl',
          config.remInPx
        )
      : [],

  'border-top-right-radius': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderRadius
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderRadius,
          'rounded-tr',
          config.remInPx
        )
      : [],

  // 'border-top-style': (declaration, config) =>
  //   strictConvertDeclarationValue(declaration.value, UTILITIES_MAPPING['border-style']),

  'border-top-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderWidth,
          'border-t',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'border-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.borderWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.borderWidth,
          'border',
          config.remInPx,
          false,
          'length'
        )
      : [],

  bottom: (declaration, config) =>
    config.tailwindConfig.corePlugins.position
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.inset,
          'bottom',
          config.remInPx,
          true
        )
      : [],

  'box-decoration-break': (declaration, config) =>
    config.tailwindConfig.corePlugins.position
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['box-decoration-break']
        )
      : [],

  'box-shadow': (declaration, config) =>
    config.tailwindConfig.corePlugins.boxShadow
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.boxShadow,
          'shadow'
        )
      : [],

  'box-sizing': (declaration, config) =>
    config.tailwindConfig.corePlugins.boxSizing
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['box-sizing']
        )
      : [],

  'break-after': (declaration, config) =>
    config.tailwindConfig.corePlugins.breakAfter
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['break-after']
        )
      : [],

  'break-before': (declaration, config) =>
    config.tailwindConfig.corePlugins.breakBefore
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['break-before']
        )
      : [],

  'break-inside': (declaration, config) =>
    config.tailwindConfig.corePlugins.breakInside
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['break-inside']
        )
      : [],

  'caret-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.caretColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.caretColor,
          'caret',
          'color'
        )
      : [],

  clear: (declaration, config) =>
    config.tailwindConfig.corePlugins.clear
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['clear']
        )
      : [],

  color: (declaration, config) =>
    config.tailwindConfig.corePlugins.textColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.textColor,
          'text',
          'color'
        )
      : [],

  'column-gap': (declaration, config) =>
    config.tailwindConfig.corePlugins.gap
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.gap,
          'gap-x',
          config.remInPx
        )
      : [],

  columns: (declaration, config) =>
    config.tailwindConfig.corePlugins.columns
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.columns,
          'columns',
          config.remInPx
        )
      : [],

  content: (declaration, config) =>
    config.tailwindConfig.corePlugins.content
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.content,
          'content'
        )
      : [],

  cursor: (declaration, config) =>
    config.tailwindConfig.corePlugins.cursor
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.cursor,
          'cursor'
        )
      : [],

  display: (declaration, config) =>
    config.tailwindConfig.corePlugins.display
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['display']
        )
      : [],

  fill: (declaration, config) =>
    config.tailwindConfig.corePlugins.fill
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.fill,
          'fill'
        )
      : [],

  filter: (declaration, config) => {
    if (!config.tailwindConfig.corePlugins.filter) {
      return [];
    }

    let classes: string[] = [];
    const mappings: Record<string, any> = {
      blur: config.tailwindConfig.corePlugins.blur && config.mapping.blur,
      brightness:
        config.tailwindConfig.corePlugins.brightness &&
        config.mapping.brightness,
      contrast:
        config.tailwindConfig.corePlugins.contrast && config.mapping.contrast,
      grayscale:
        config.tailwindConfig.corePlugins.grayscale && config.mapping.grayscale,
      'hue-rotate':
        config.tailwindConfig.corePlugins.hueRotate && config.mapping.hueRotate,
      invert: config.tailwindConfig.corePlugins.invert && config.mapping.invert,
      opacity:
        config.tailwindConfig.corePlugins.opacity && config.mapping.opacity,
      saturate:
        config.tailwindConfig.corePlugins.saturate && config.mapping.saturate,
      sepia: config.tailwindConfig.corePlugins.sepia && config.mapping.sepia,
      // 'drop-shadow': config.tailwindConfig.corePlugins.dropShadow && config.mapping.dropShadow,
    };

    parseCSSFunctions(declaration.value).every(({ name, value }) => {
      if (name == null || value == null) {
        classes = [];
        return false;
      }

      const mapping = mappings[name];

      if (mapping) {
        delete mapping[name];

        const currentClasses = convertSizeDeclarationValue(
          value,
          mapping,
          name,
          config.remInPx,
          name === 'hue-rotate'
        );

        if (currentClasses?.length) {
          classes = classes.concat(currentClasses);
          return true;
        }
      }

      classes = [];
      return false;
    });

    return classes;
  },

  flex: (declaration, config) => {
    if (!config.tailwindConfig.corePlugins.flex) {
      return [];
    }

    let classes = convertDeclarationValue(
      declaration.value,
      config.mapping.flex,
      'flex',
      ''
    );

    if (classes.length) {
      return classes;
    }

    const [flexGrow, flexShrink = '1', flexBasis = '0%'] = declaration.value
      .trim()
      .split(/\s+/m);

    return convertDeclarationValue(
      `${flexGrow} ${flexShrink} ${flexBasis}`,
      config.mapping.flex,
      'flex',
      declaration.value
    );
  },

  'flex-basis': (declaration, config) =>
    config.tailwindConfig.corePlugins.flexBasis
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.flexBasis,
          'basis',
          config.remInPx
        )
      : [],

  'flex-direction': (declaration, config) =>
    config.tailwindConfig.corePlugins.flexDirection
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['flex-direction']
        )
      : [],

  'flex-grow': (declaration, config) =>
    config.tailwindConfig.corePlugins.flexGrow
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.flexGrow,
          'grow'
        )
      : [],

  'flex-shrink': (declaration, config) =>
    config.tailwindConfig.corePlugins.flexShrink
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.flexShrink,
          'shrink'
        )
      : [],

  'flex-wrap': (declaration, config) =>
    config.tailwindConfig.corePlugins.flexWrap
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['flex-wrap']
        )
      : [],

  float: (declaration, config) =>
    config.tailwindConfig.corePlugins.float
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['float']
        )
      : [],

  'font-size': (declaration, config) =>
    config.tailwindConfig.corePlugins.fontSize
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.fontSize,
          'text',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'font-smoothing': (declaration, config) =>
    config.tailwindConfig.corePlugins.fontSmoothing
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['font-smoothing']
        )
      : [],

  'font-style': (declaration, config) =>
    config.tailwindConfig.corePlugins.fontStyle
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['font-style']
        )
      : [],

  'font-variant-numeric': (declaration, config) =>
    config.tailwindConfig.corePlugins.fontVariantNumeric
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['font-variant-numeric']
        )
      : [],

  'font-weight': (declaration, config) =>
    config.tailwindConfig.corePlugins.fontWeight
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.fontWeight,
          'font',
          declaration.value,
          'font',
          'number'
        )
      : [],

  gap: (declaration, config) =>
    config.tailwindConfig.corePlugins.gap
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.gap,
          'gap',
          config.remInPx
        )
      : [],

  'grid-auto-columns': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridAutoColumns
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridAutoColumns,
          'auto-cols'
        )
      : [],

  'grid-auto-flow': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridAutoFlow
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['grid-auto-flow']
        )
      : [],

  'grid-auto-rows': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridAutoRows
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridAutoRows,
          'auto-rows'
        )
      : [],

  'grid-column': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridColumn
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridColumn,
          'col'
        )
      : [],

  'grid-column-end': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridColumnEnd
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridColumnEnd,
          'col-end'
        )
      : [],

  'grid-column-gap': (declaration, config) =>
    config.tailwindConfig.corePlugins.gap
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.gap,
          'gap-x',
          config.remInPx
        )
      : [],

  'grid-column-start': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridColumnStart
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridColumnStart,
          'col-start'
        )
      : [],

  'grid-gap': (declaration, config) =>
    config.tailwindConfig.corePlugins.gap
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.gap,
          'gap',
          config.remInPx
        )
      : [],

  'grid-row': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridRow
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridRow,
          'row'
        )
      : [],

  'grid-row-end': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridRowEnd
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridRowEnd,
          'row-end'
        )
      : [],

  'grid-row-gap': (declaration, config) =>
    config.tailwindConfig.corePlugins.gap
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.gap,
          'gap-y',
          config.remInPx
        )
      : [],

  'grid-row-start': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridRowStart
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridRowStart,
          'row-start'
        )
      : [],

  'grid-template-columns': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridTemplateColumns
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridTemplateColumns,
          'grid-cols'
        )
      : [],

  'grid-template-rows': (declaration, config) =>
    config.tailwindConfig.corePlugins.gridTemplateRows
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.gridTemplateRows,
          'grid-rows'
        )
      : [],

  height: (declaration, config) =>
    config.tailwindConfig.corePlugins.height
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.height,
          'h',
          config.remInPx
        )
      : [],

  inset: (declaration, config) =>
    config.tailwindConfig.corePlugins.inset
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.inset,
          'inset',
          config.remInPx,
          true
        )
      : [],

  isolation: (declaration, config) =>
    config.tailwindConfig.corePlugins.isolation
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['isolation']
        )
      : [],

  'justify-content': (declaration, config) =>
    config.tailwindConfig.corePlugins.justifyContent
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['justify-content']
        )
      : [],

  'justify-items': (declaration, config) =>
    config.tailwindConfig.corePlugins.justifyItems
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['justify-items']
        )
      : [],

  'justify-self': (declaration, config) =>
    config.tailwindConfig.corePlugins.justifySelf
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['justify-self']
        )
      : [],

  left: (declaration, config) =>
    config.tailwindConfig.corePlugins.position
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.inset,
          'left',
          config.remInPx,
          true
        )
      : [],

  'letter-spacing': (declaration, config) =>
    config.tailwindConfig.corePlugins.letterSpacing
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.letterSpacing,
          'tracking',
          config.remInPx,
          true
        )
      : [],

  'line-height': (declaration, config) =>
    config.tailwindConfig.corePlugins.lineHeight
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.lineHeight,
          'leading',
          config.remInPx
        )
      : [],

  'list-style-position': (declaration, config) =>
    config.tailwindConfig.corePlugins.listStylePosition
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['list-style-position']
        )
      : [],

  'list-style-type': (declaration, config) =>
    config.tailwindConfig.corePlugins.listStyleType
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.listStyleType,
          'list'
        )
      : [],

  margin: (declaration, config) =>
    config.tailwindConfig.corePlugins.margin
      ? convertComposedSpacingDeclarationValue(
          declaration.value,
          {
            top: { valuesMapping: config.mapping.margin, classPrefix: 'mt' },
            right: { valuesMapping: config.mapping.margin, classPrefix: 'mr' },
            bottom: { valuesMapping: config.mapping.margin, classPrefix: 'mb' },
            left: { valuesMapping: config.mapping.margin, classPrefix: 'ml' },
          },
          config.remInPx
        )
      : [],

  'margin-bottom': (declaration, config) =>
    config.tailwindConfig.corePlugins.margin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.margin,
          'mb',
          config.remInPx,
          true
        )
      : [],

  'margin-left': (declaration, config) =>
    config.tailwindConfig.corePlugins.margin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.margin,
          'ml',
          config.remInPx,
          true
        )
      : [],

  'margin-right': (declaration, config) =>
    config.tailwindConfig.corePlugins.margin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.margin,
          'mr',
          config.remInPx,
          true
        )
      : [],

  'margin-top': (declaration, config) =>
    config.tailwindConfig.corePlugins.margin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.margin,
          'mt',
          config.remInPx,
          true
        )
      : [],

  'max-height': (declaration, config) =>
    config.tailwindConfig.corePlugins.maxHeight
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.maxHeight,
          'max-h',
          config.remInPx
        )
      : [],

  'max-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.maxWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.maxWidth,
          'max-w',
          config.remInPx
        )
      : [],

  'min-height': (declaration, config) =>
    config.tailwindConfig.corePlugins.minHeight
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.minHeight,
          'min-h',
          config.remInPx
        )
      : [],

  'min-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.minWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.minWidth,
          'min-w',
          config.remInPx
        )
      : [],

  'mix-blend-mode': (declaration, config) =>
    config.tailwindConfig.corePlugins.mixBlendMode
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['mix-blend-mode']
        )
      : [],

  'object-fit': (declaration, config) =>
    config.tailwindConfig.corePlugins.objectFit
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['object-fit']
        )
      : [],

  'object-position': (declaration, config) =>
    config.tailwindConfig.corePlugins.objectPosition
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.objectPosition,
          'object'
        )
      : [],

  opacity: (declaration, config) =>
    config.tailwindConfig.corePlugins.opacity
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.opacity,
          'opacity'
        )
      : [],

  order: (declaration, config) =>
    config.tailwindConfig.corePlugins.order
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.order,
          'order',
          null,
          true
        )
      : [],

  outline: (declaration, config) =>
    config.tailwindConfig.corePlugins.outlineStyle
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['outline']
        )
      : [],

  'outline-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.outlineColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.outlineColor,
          'outline',
          'color'
        )
      : [],

  'outline-offset': (declaration, config) =>
    config.tailwindConfig.corePlugins.outlineOffset
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.outlineOffset,
          'outline-offset',
          config.remInPx,
          true,
          'length'
        )
      : [],

  'outline-style': (declaration, config) =>
    config.tailwindConfig.corePlugins.outlineStyle
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['outline-style']
        )
      : [],

  'outline-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.outlineWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.outlineWidth,
          'outline',
          config.remInPx,
          false,
          'length'
        )
      : [],

  overflow: (declaration, config) =>
    config.tailwindConfig.corePlugins.overflow
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overflow']
        )
      : [],

  'overflow-wrap': (declaration, config) =>
    config.tailwindConfig.corePlugins.wordBreak
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overflow-wrap']
        )
      : [],

  'overflow-x': (declaration, config) =>
    config.tailwindConfig.corePlugins.overflow
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overflow-x']
        )
      : [],

  'overflow-y': (declaration, config) =>
    config.tailwindConfig.corePlugins.overflow
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overflow-y']
        )
      : [],

  'overscroll-behavior': (declaration, config) =>
    config.tailwindConfig.corePlugins.overscrollBehavior
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overscroll-behavior']
        )
      : [],
  'overscroll-behavior-x': (declaration, config) =>
    config.tailwindConfig.corePlugins.overscrollBehavior
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overscroll-behavior-x']
        )
      : [],
  'overscroll-behavior-y': (declaration, config) =>
    config.tailwindConfig.corePlugins.overscrollBehavior
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['overscroll-behavior-y']
        )
      : [],

  padding: (declaration, config) =>
    config.tailwindConfig.corePlugins.padding
      ? convertComposedSpacingDeclarationValue(
          declaration.value,
          {
            top: { valuesMapping: config.mapping.padding, classPrefix: 'pt' },
            right: { valuesMapping: config.mapping.padding, classPrefix: 'pr' },
            bottom: {
              valuesMapping: config.mapping.padding,
              classPrefix: 'pb',
            },
            left: { valuesMapping: config.mapping.padding, classPrefix: 'pl' },
          },
          config.remInPx
        )
      : [],

  'padding-bottom': (declaration, config) =>
    config.tailwindConfig.corePlugins.padding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.padding,
          'pb',
          config.remInPx
        )
      : [],

  'padding-left': (declaration, config) =>
    config.tailwindConfig.corePlugins.padding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.padding,
          'pl',
          config.remInPx
        )
      : [],

  'padding-right': (declaration, config) =>
    config.tailwindConfig.corePlugins.padding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.padding,
          'pr',
          config.remInPx
        )
      : [],

  'padding-top': (declaration, config) =>
    config.tailwindConfig.corePlugins.padding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.padding,
          'pt',
          config.remInPx
        )
      : [],

  'page-break-after': (declaration, config) =>
    config.tailwindConfig.corePlugins.breakAfter
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['break-after']
        )
      : [],

  'page-break-before': (declaration, config) =>
    config.tailwindConfig.corePlugins.breakBefore
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['break-before']
        )
      : [],

  'page-break-inside': (declaration, config) =>
    config.tailwindConfig.corePlugins.breakInside
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['break-inside']
        )
      : [],

  'place-content': (declaration, config) =>
    config.tailwindConfig.corePlugins.placeContent
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['place-content']
        )
      : [],

  'place-items': (declaration, config) =>
    config.tailwindConfig.corePlugins.placeItems
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['place-items']
        )
      : [],

  'place-self': (declaration, config) =>
    config.tailwindConfig.corePlugins.placeSelf
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['place-self']
        )
      : [],

  'pointer-events': (declaration, config) =>
    config.tailwindConfig.corePlugins.pointerEvents
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['pointer-events']
        )
      : [],

  position: (declaration, config) =>
    config.tailwindConfig.corePlugins.position
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['position']
        )
      : [],

  resize: (declaration, config) =>
    config.tailwindConfig.corePlugins.resize
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['resize']
        )
      : [],

  right: (declaration, config) =>
    config.tailwindConfig.corePlugins.position
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.inset,
          'right',
          config.remInPx,
          true
        )
      : [],

  'row-gap': (declaration, config) =>
    config.tailwindConfig.corePlugins.gap
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.gap,
          'gap-y',
          config.remInPx
        )
      : [],

  'scroll-behavior': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollBehavior
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['scroll-behavior']
        )
      : [],

  'scroll-margin': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollMargin
      ? convertComposedSpacingDeclarationValue(
          declaration.value,
          {
            top: {
              valuesMapping: config.mapping.scrollMargin,
              classPrefix: 'scroll-mt',
            },
            right: {
              valuesMapping: config.mapping.scrollMargin,
              classPrefix: 'scroll-mr',
            },
            bottom: {
              valuesMapping: config.mapping.scrollMargin,
              classPrefix: 'scroll-mb',
            },
            left: {
              valuesMapping: config.mapping.scrollMargin,
              classPrefix: 'scroll-ml',
            },
          },
          config.remInPx
        )
      : [],

  'scroll-margin-bottom': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollMargin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollMargin,
          'scroll-mb',
          config.remInPx,
          true
        )
      : [],

  'scroll-margin-left': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollMargin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollMargin,
          'scroll-ml',
          config.remInPx,
          true
        )
      : [],

  'scroll-margin-right': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollMargin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollMargin,
          'scroll-mr',
          config.remInPx,
          true
        )
      : [],

  'scroll-margin-top': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollMargin
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollMargin,
          'scroll-mt',
          config.remInPx,
          true
        )
      : [],

  'scroll-padding': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollPadding
      ? convertComposedSpacingDeclarationValue(
          declaration.value,
          {
            top: {
              valuesMapping: config.mapping.scrollPadding,
              classPrefix: 'scroll-pt',
            },
            right: {
              valuesMapping: config.mapping.scrollPadding,
              classPrefix: 'scroll-pr',
            },
            bottom: {
              valuesMapping: config.mapping.scrollPadding,
              classPrefix: 'scroll-pb',
            },
            left: {
              valuesMapping: config.mapping.scrollPadding,
              classPrefix: 'scroll-pl',
            },
          },
          config.remInPx
        )
      : [],

  'scroll-padding-bottom': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollPadding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollPadding,
          'scroll-pb',
          config.remInPx
        )
      : [],

  'scroll-padding-left': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollPadding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollPadding,
          'scroll-pl',
          config.remInPx
        )
      : [],

  'scroll-padding-right': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollPadding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollPadding,
          'scroll-pr',
          config.remInPx
        )
      : [],

  'scroll-padding-top': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollPadding
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.scrollPadding,
          'scroll-pt',
          config.remInPx
        )
      : [],

  'scroll-snap-align': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollSnapAlign
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['scroll-snap-align']
        )
      : [],

  'scroll-snap-type': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollSnapType
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['scroll-snap-type']
        )
      : [],

  'scroll-snap-stop': (declaration, config) =>
    config.tailwindConfig.corePlugins.scrollSnapStop
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['scroll-snap-stop']
        )
      : [],

  stroke: (declaration, config) =>
    config.tailwindConfig.corePlugins.stroke
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.stroke,
          'stroke',
          'color'
        )
      : [],

  'stroke-width': (declaration, config) =>
    config.tailwindConfig.corePlugins.strokeWidth
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.strokeWidth,
          'stroke',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'table-layout': (declaration, config) =>
    config.tailwindConfig.corePlugins.tableLayout
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['table-layout']
        )
      : [],

  'text-align': (declaration, config) =>
    config.tailwindConfig.corePlugins.textAlign
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['text-align']
        )
      : [],

  'text-decoration': (declaration, config) => {
    if (!config.tailwindConfig.corePlugins.textDecoration) {
      return [];
    }

    const parsed = declaration.value.trim().split(/\s+/m);
    return parsed.length === 1
      ? strictConvertDeclarationValue(
          parsed[0],
          UTILITIES_MAPPING['text-decoration-line']
        )
      : [];
  },

  'text-decoration-color': (declaration, config) =>
    config.tailwindConfig.corePlugins.textDecorationColor
      ? convertColorDeclarationValue(
          declaration.value,
          config.mapping.textDecorationColor,
          'decoration',
          'color'
        )
      : [],

  'text-decoration-line': (declaration, config) =>
    config.tailwindConfig.corePlugins.textDecoration
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['text-decoration-line']
        )
      : [],

  'text-decoration-style': (declaration, config) =>
    config.tailwindConfig.corePlugins.textDecorationStyle
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['text-decoration-style']
        )
      : [],

  'text-decoration-thickness': (declaration, config) =>
    config.tailwindConfig.corePlugins.textDecorationThickness
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.textDecorationThickness,
          'decoration',
          config.remInPx,
          false,
          'length'
        )
      : [],

  'text-indent': (declaration, config) =>
    config.tailwindConfig.corePlugins.textIndent
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.textIndent,
          'indent',
          config.remInPx,
          true
        )
      : [],

  'text-overflow': (declaration, config) =>
    config.tailwindConfig.corePlugins.textOverflow
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['text-overflow']
        )
      : [],

  'text-transform': (declaration, config) =>
    config.tailwindConfig.corePlugins.textTransform
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['text-transform']
        )
      : [],

  'text-underline-offset': (declaration, config) =>
    config.tailwindConfig.corePlugins.textUnderlineOffset
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.textUnderlineOffset,
          'underline-offset',
          config.remInPx,
          false,
          'length'
        )
      : [],

  top: (declaration, config) =>
    config.tailwindConfig.corePlugins.position
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.inset,
          'top',
          config.remInPx,
          true
        )
      : [],

  'touch-action': (declaration, config) =>
    config.tailwindConfig.corePlugins.touchAction
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['touch-action']
        )
      : [],

  transform: (declaration, config) => {
    if (!config.tailwindConfig.corePlugins.transform) {
      return [];
    }

    let classes: string[] = [];

    function split(value: string) {
      return value.split(/\s*,\s*/m).map(v => v.trim());
    }

    function convertTranslate(
      value: string,
      axis: 'x' | 'y' | 'both' = 'both'
    ): string[] {
      if (axis === 'both') {
        const splitted = split(value);
        return splitted.length > 2
          ? []
          : [
              ...(splitted[0] ? convertTranslate(splitted[0], 'x') : []),
              ...(splitted[1] ? convertTranslate(splitted[1], 'y') : []),
            ];
      }

      return convertSizeDeclarationValue(
        value,
        config.mapping.translate,
        `translate-${axis}`,
        config.remInPx,
        true
      );
    }

    function convertSkew(
      value: string,
      axis: 'x' | 'y' | 'both' = 'both'
    ): string[] {
      if (axis === 'both') {
        const splitted = split(value);
        return splitted.length > 2
          ? []
          : [
              ...(splitted[0] ? convertSkew(splitted[0], 'x') : []),
              ...(splitted[1] ? convertSkew(splitted[1], 'y') : []),
            ];
      }

      return convertSizeDeclarationValue(
        value,
        config.mapping.skew,
        `skew-${axis}`,
        config.remInPx,
        true
      );
    }

    function convertScale(
      value: string,
      axis: 'x' | 'y' | 'both' = 'both'
    ): string[] {
      if (axis === 'both') {
        const splitted = split(value);

        if (splitted.length > 2) {
          return [];
        }

        if (splitted[0]) {
          return [
            ...convertScale(splitted[0], 'x'),
            ...convertScale(splitted[1] || splitted[0], 'y'),
          ];
        }
      }

      return convertSizeDeclarationValue(
        value,
        config.mapping.scale,
        `scale-${axis}`,
        config.remInPx,
        true
      );
    }

    parseCSSFunctions(declaration.value).every(({ name, value }) => {
      if (name == null || value == null) {
        classes = [];
        return false;
      }

      let converted: string[] = [];

      if (config.tailwindConfig.corePlugins.translate) {
        if (name === 'translate') {
          converted = convertTranslate(value, 'both');
        } else if (name === 'translateX') {
          converted = convertTranslate(value, 'x');
        } else if (name === 'translateY') {
          converted = convertTranslate(value, 'y');
        }
      }

      if (config.tailwindConfig.corePlugins.skew) {
        if (name === 'skew') {
          converted = convertSkew(value, 'both');
        } else if (name === 'skewX') {
          converted = convertSkew(value, 'x');
        } else if (name === 'skewY') {
          converted = convertSkew(value, 'y');
        }
      }

      if (config.tailwindConfig.corePlugins.scale) {
        if (name === 'scale') {
          converted = convertScale(value, 'both');
        } else if (name === 'scaleX') {
          converted = convertScale(value, 'x');
        } else if (name === 'scaleY') {
          converted = convertScale(value, 'y');
        }
      }

      if (config.tailwindConfig.corePlugins.rotate && name === 'rotate') {
        converted = convertSizeDeclarationValue(
          value,
          config.mapping.rotate,
          'rotate',
          config.remInPx,
          true
        );
      }

      if (converted.length) {
        classes = classes.concat(converted);
        return true;
      }

      classes = [];
      return false;
    });

    return classes;
  },

  'transform-origin': (declaration, config) =>
    config.tailwindConfig.corePlugins.transformOrigin
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.transformOrigin,
          'origin'
        )
      : [],

  transition: (declaration, config) => {
    let classes: string[] = [];
    let hasDelay = false;

    removeUnnecessarySpaces(declaration.value.trim())
      .split(/\s+/m)
      .map(v => v.trim())
      .every((value, index) => {
        let itemClasses: string[] = [];

        if (index === 0) {
          itemClasses = config.tailwindConfig.corePlugins.transitionProperty
            ? convertDeclarationValue(
                value,
                config.mapping.transitionProperty,
                'transition'
              )
            : [];
        } else if (index === 1) {
          itemClasses = config.tailwindConfig.corePlugins.transitionDuration
            ? convertDeclarationValue(
                value,
                config.mapping.transitionDuration,
                'duration'
              )
            : [];
        } else if (index === 2) {
          const isTimingFunction = isNaN(parseFloat(value));

          if (isTimingFunction) {
            itemClasses = config.tailwindConfig.corePlugins
              .transitionTimingFunction
              ? convertDeclarationValue(
                  value,
                  config.mapping.transitionTimingFunction,
                  'ease'
                )
              : [];
          } else {
            hasDelay = true;
            itemClasses = config.tailwindConfig.corePlugins.transitionDelay
              ? convertDeclarationValue(
                  value,
                  config.mapping.transitionDelay,
                  'delay'
                )
              : [];
          }
        } else if (index === 3) {
          itemClasses =
            config.tailwindConfig.corePlugins.transitionDelay && !hasDelay
              ? convertDeclarationValue(
                  value,
                  config.mapping.transitionDelay,
                  'delay'
                )
              : [];

          hasDelay = true;
        }

        if (!itemClasses.length) {
          classes = [];
          return false;
        }

        classes = classes.concat(itemClasses);
        return true;
      });

    return classes;
  },

  'transition-delay': (declaration, config) =>
    config.tailwindConfig.corePlugins.transitionDelay
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.transitionDelay,
          'delay'
        )
      : [],

  'transition-duration': (declaration, config) =>
    config.tailwindConfig.corePlugins.transitionDuration
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.transitionDuration,
          'duration'
        )
      : [],

  'transition-property': (declaration, config) =>
    config.tailwindConfig.corePlugins.transitionProperty
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.transitionProperty,
          'transition'
        )
      : [],

  'transition-timing-function': (declaration, config) =>
    config.tailwindConfig.corePlugins.transitionTimingFunction
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.transitionTimingFunction,
          'ease'
        )
      : [],

  'user-select': (declaration, config) =>
    config.tailwindConfig.corePlugins.userSelect
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['user-select']
        )
      : [],

  'vertical-align': (declaration, config) =>
    config.tailwindConfig.corePlugins.verticalAlign
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['vertical-align']
        )
      : [],

  visibility: (declaration, config) =>
    config.tailwindConfig.corePlugins.visibility
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['visibility']
        )
      : [],

  'white-space': (declaration, config) =>
    config.tailwindConfig.corePlugins.whitespace
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['white-space']
        )
      : [],

  width: (declaration, config) =>
    config.tailwindConfig.corePlugins.width
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.width,
          'w',
          config.remInPx
        )
      : [],

  'will-change': (declaration, config) =>
    config.tailwindConfig.corePlugins.willChange
      ? convertDeclarationValue(
          declaration.value,
          config.mapping.willChange,
          'will-change'
        )
      : [],

  'word-break': (declaration, config) =>
    config.tailwindConfig.corePlugins.wordBreak
      ? strictConvertDeclarationValue(
          declaration.value,
          UTILITIES_MAPPING['word-break']
        )
      : [],

  'z-index': (declaration, config) =>
    config.tailwindConfig.corePlugins.zIndex
      ? convertSizeDeclarationValue(
          declaration.value,
          config.mapping.zIndex,
          'z',
          null,
          true
        )
      : [],
};
