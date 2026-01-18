import type { AtRule, Node } from 'postcss';

export function isAtRuleNode(node: Node | undefined): node is AtRule {
  return !!(node?.type === 'atrule');
}
