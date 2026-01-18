import type { Config } from 'tailwindcss';
import type { Expand } from 'tailwindcss/types/config';
import type { CorePluginList } from 'tailwindcss/types/generated/corePluginList';

import baseResolveConfig from 'tailwindcss/resolveConfig';

export interface ResolvedTailwindConfig extends Omit<Config, 'content'> {
  content: Config['content'];
  prefix: string;
  separator: string;
  corePlugins: Expand<Partial<Record<CorePluginList, boolean>>>;
}

export function resolveConfig(config: Config) {
  const resolved = baseResolveConfig(config);
  return {
    ...resolved,
    prefix: resolved.prefix || '',
    separator: resolved.separator || ':',
    corePlugins: (resolved['corePlugins'] as CorePluginList[]).reduce(
      (prev, current) => {
        prev[current] = true;
        return prev;
      },
      {} as ResolvedTailwindConfig['corePlugins']
    ),
  };
}
