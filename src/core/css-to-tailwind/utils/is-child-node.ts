import type { Node, ChildNode } from 'postcss';

export function isChildNode(node: Node | undefined): node is ChildNode {
  return !!(
    node &&
    (node.type === 'atrule' ||
      node.type === 'rule' ||
      node.type === 'decl' ||
      node.type === 'comment')
  );
}
