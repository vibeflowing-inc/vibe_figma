import { type AtRule, type Node, Rule,  type ChildNode } from 'postcss';
import { isAtRuleNode } from './utils/is-at-rule-node.js';
import { isChildNode } from './utils/is-child-node.js';

export interface ResolvedTailwindNode {
  rule: Rule;
  tailwindClasses: string[];
}

export interface UnresolvedTailwindNode {
  key: string;
  rootRuleSelector?: string | null;
  originalRule: Rule;
  classesPrefix: string;
  tailwindClasses: string[];
}

export type TailwindNode = ResolvedTailwindNode | UnresolvedTailwindNode;

export function isResolvedTailwindNode(
  node: TailwindNode
): node is ResolvedTailwindNode {
  return 'rule' in node;
}

export function isUnresolvedTailwindNode(
  node: TailwindNode
): node is UnresolvedTailwindNode {
  return !isResolvedTailwindNode(node);
}

export class TailwindNodesManager {
  protected nodesMap: Map<string, ResolvedTailwindNode>;

  constructor(initialNodes?: TailwindNode[]) {
    this.nodesMap = new Map();
    if (initialNodes?.length) {
      this.mergeNodes(initialNodes);
    }
  }

  mergeNode(node: TailwindNode) {
    const nodeIsResolved = isResolvedTailwindNode(node);
    const nodeKey = nodeIsResolved
      ? TailwindNodesManager.convertRuleToKey(node.rule)
      : node.key;
    const foundNode = this.nodesMap.get(nodeKey);

    if (foundNode) {
      foundNode.tailwindClasses = foundNode.tailwindClasses.concat(
        nodeIsResolved
          ? node.tailwindClasses
          : node.tailwindClasses.map(
              className => `${node.classesPrefix}${className}`
            )
      );

      return;
    }

    if (nodeIsResolved) {
      this.nodesMap.set(nodeKey, node);
    } else {
      let rule;

      if (node.rootRuleSelector) {
        rule = new Rule({
          selector: node.rootRuleSelector,
        });

        const rootChild = this.upToRootChild(node.originalRule);
        if (rootChild) {
          node.originalRule.root().insertBefore(rootChild, rule);
        }
      } else {
        rule = node.originalRule;
      }

      this.nodesMap.set(nodeKey, {
        rule,
        tailwindClasses: node.tailwindClasses.map(
          className => `${node.classesPrefix}${className}`
        ),
      });
    }
  }

  mergeNodes(nodes: TailwindNode[]) {
    nodes.forEach(node => {
      this.mergeNode(node);
    });
  }

  hasNode(key: string) {
    return this.nodesMap.has(key);
  }

  getNode(key: string) {
    return this.nodesMap.get(key) || null;
  }

  getNodes() {
    return Array.from(this.nodesMap.values());
  }

  protected upToRootChild(node: Node) {
    let childNode: ChildNode | null = null;

    while (
      node.parent &&
      node.parent.type !== 'root' &&
      isChildNode(node.parent)
    ) {
      childNode = node = node.parent;
      continue;
    }

    return childNode;
  }

  static convertRuleToKey(
    rule: Rule,
    overriddenSelector: string | null = null
  ) {
    let currentParent = rule.parent;
    let parentKey = '';

    while (isChildNode(currentParent)) {
      parentKey +=
        (isAtRuleNode(currentParent)
          ? this.makeSingleAtRuleKey(currentParent)
          : this.makeSingleRuleKey(currentParent)) + '__';

      currentParent = currentParent.parent;
    }

    return (
      parentKey +
      (overriddenSelector == null ? rule.selector : overriddenSelector)
    );
  }

  protected static makeSingleAtRuleKey(atRule: AtRule) {
    return 'a(' + atRule.name + '|' + atRule.params + ')';
  }

  protected static makeSingleRuleKey(atRule: Rule) {
    return 'r(' + atRule.selector + ')';
  }
}
