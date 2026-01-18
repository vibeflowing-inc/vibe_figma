export function flattenObject(
  object: Record<string | number | symbol, any>,
  separator = '-'
) {
  let flatObject: Record<string, any> = {};

  for (let prop in object) {
    if (!Object.prototype.hasOwnProperty.call(object, prop)) continue;

    if (typeof object[prop] === 'object' && object[prop] !== null) {
      const nestedFlatObject = flattenObject(object[prop], separator);

      for (let nestedProp in nestedFlatObject) {
        if (!Object.prototype.hasOwnProperty.call(nestedFlatObject, nestedProp))
          continue;

        flatObject[prop + separator + nestedProp] =
          nestedFlatObject[nestedProp];
      }
    } else {
      flatObject[prop] = object[prop];
    }
  }
  return flatObject;
}
