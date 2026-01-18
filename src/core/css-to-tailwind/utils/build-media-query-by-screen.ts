import type { Screen } from 'tailwindcss/types/config';

export function buildMediaQueryByScreen(screens: string | Screen | Screen[]) {
  if (typeof screens === 'string') {
    return `(min-width: ${screens})`;
  }

  screens = Array.isArray(screens) ? screens : [screens];

  return screens
    .map(screen => {
      if ('raw' in screen && screen['raw']) {
        return screen['raw'];
      }

      let conditions = [];
      if ('min' in screen && screen['min']) {
        conditions.push(`(min-width: ${screen['min']})`);
      }

      if ('max' in screen && screen['max']) {
        conditions.push(`(max-width: ${screen['max']})`);
      }

      if (conditions.length) {
        return conditions.join(' and ');
      }

      return null;
    })
    .filter(Boolean)
    .join(', ');
}
