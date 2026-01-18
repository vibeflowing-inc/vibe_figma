import { isObject } from './is-object';

class TailwindClassesReductionManager {
  protected resolvedClasses: string[] = [];
  protected map: Record<string, any> = {
    m: { mx: { ml: [], mr: [] }, my: { mt: [], mb: [] } },
    p: { px: { pl: [], pr: [] }, py: { pt: [], pb: [] } },
    'scroll-m': {
      'scroll-mx': {
        'scroll-ml': [],
        'scroll-mr': [],
      },
      'scroll-my': {
        'scroll-mt': [],
        'scroll-mb': [],
      },
    },
    'scroll-p': {
      'scroll-px': {
        'scroll-pl': [],
        'scroll-pr': [],
      },
      'scroll-py': {
        'scroll-pt': [],
        'scroll-pb': [],
      },
    },
    rounded: {
      'rounded-t': {
        'rounded-tl': [],
        'rounded-tr': [],
      },
      'rounded-r': {
        'rounded-tr': [],
        'rounded-br': [],
      },
      'rounded-b': {
        'rounded-bl': [],
        'rounded-br': [],
      },
      'rounded-l': {
        'rounded-tl': [],
        'rounded-bl': [],
      },
    },
    border: {
      'border-x': {
        'border-l': [],
        'border-r': [],
      },
      'border-y': {
        'border-t': [],
        'border-b': [],
      },
    },
    scale: {
      'scale-x': [],
      'scale-y': [],
    },
    inset: {
      'inset-x': {
        left: [],
        right: [],
      },
      'inset-y': {
        top: [],
        bottom: [],
      },
    },
  };

  appendClassName(className: string) {
    const { value, classPrefix } = this.parseTailwindClass(className);

    if (!value || !this.recursiveSetValue(classPrefix, value, this.map)) {
      this.resolvedClasses.push(className);
    }
  }

  reduce() {
    Object.keys(this.map).forEach(mapKey => {
      this.recursiveResolveClasses(
        this.map[mapKey],
        this.resolvedClasses
      ).forEach((_, value) => {
        this.resolvedClasses.push(this.toTailwindClass(mapKey, value));
      });
    });

    return this.resolvedClasses;
  }

  protected recursiveSetValue(
    key: string,
    value: string,
    targetObject: Record<string, any>
  ) {
    for (let objectKey in targetObject) {
      if (!Object.prototype.hasOwnProperty.call(targetObject, objectKey))
        continue;

      const objectValue = targetObject[objectKey];

      if (objectKey === key) {
        if (isObject(objectValue)) {
          this.recursiveSetValueToAllKeys(value, objectValue);
        } else if (Array.isArray(objectValue)) {
          objectValue.push(value);
        }

        return true;
      }

      if (isObject(objectValue)) {
        const isSet = this.recursiveSetValue(key, value, objectValue);

        if (isSet) {
          return true;
        }
      }
    }

    return false;
  }

  protected recursiveSetValueToAllKeys(
    value: string,
    targetObject: Record<string, any>
  ) {
    Object.keys(targetObject).forEach(key => {
      this.recursiveSetValue(key, value, targetObject);
    });
  }

  protected recursiveResolveClasses(
    targetObject: Record<string, any>,
    resolvedClasses: string[]
  ) {
    let commonValuesMap: null | Map<string, string> = null;

    const intersectCommonValues = (valuesMap: Map<string, string>) => {
      if (commonValuesMap == null) {
        commonValuesMap = valuesMap;
      } else {
        commonValuesMap.forEach((commonClassPrefix, commonValue) => {
          const classPrefix = valuesMap.get(commonValue);
          if (classPrefix) {
            commonValuesMap?.set(commonValue, classPrefix);
          } else {
            commonValuesMap?.delete(commonValue);
            resolvedClasses.push(
              this.toTailwindClass(commonClassPrefix, commonValue)
            );
          }
        });

        valuesMap.forEach((classPrefix, value) => {
          if (commonValuesMap?.has(value)) {
            commonValuesMap.set(value, classPrefix);
          } else {
            resolvedClasses.push(this.toTailwindClass(classPrefix, value));
          }
        });
      }
    };

    Object.keys(targetObject).forEach(currentClassPrefix => {
      const objectValue = targetObject[currentClassPrefix];

      if (isObject(objectValue)) {
        const commonValuesMap = this.recursiveResolveClasses(
          objectValue,
          resolvedClasses
        );
        commonValuesMap.forEach((_, value, map) => {
          map.set(value, currentClassPrefix);
        });
        intersectCommonValues(commonValuesMap);
      } else if (Array.isArray(objectValue)) {
        intersectCommonValues(
          new Map(objectValue.map(value => [value, currentClassPrefix]))
        );
      }
    });

    return commonValuesMap || new Map<string, string>();
  }

  protected toTailwindClass(classPrefix: string, value: any) {
    if (typeof value !== 'string') {
      value = value == null ? '' : value.toString();
    }

    if (value.startsWith('-')) {
      value = value.substring(1);
      classPrefix = `-${classPrefix}`;
    }

    return `${classPrefix}-${value}`;
  }

  protected parseTailwindClass(tailwindClass: string) {
    const isNegativeValue = tailwindClass.startsWith('-');
    if (isNegativeValue) {
      tailwindClass = tailwindClass.substring(1);
    }

    const lastDashIndex = tailwindClass.lastIndexOf('-');
    if (lastDashIndex === -1) {
      return {
        value: null,
        classPrefix: tailwindClass,
      };
    }

    const classPrefix = tailwindClass.slice(0, lastDashIndex);
    const absoluteValue = tailwindClass.slice(lastDashIndex + 1);

    return {
      value: isNegativeValue ? `-${absoluteValue}` : absoluteValue,
      classPrefix,
    };
  }
}

export function reduceTailwindClasses(tailwindClasses: string[]) {
  const manager = new TailwindClassesReductionManager();

  tailwindClasses.forEach(className => {
    manager.appendClassName(className);
  });

  return manager.reduce();
}
