import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

type Options = {
  componentName?: string;
  preferMap?: boolean;
  minRepeats?: number;
};

type VarSite = {
  kind: "text" | "attr";
  propKey: string;
  path: number[];
  attrName?: string;
};

type JSXChildNode =
  | t.JSXElement
  | t.JSXFragment
  | t.JSXExpressionContainer
  | t.JSXText
  | t.JSXSpreadChild;

const SKIP_AUTO_COMPONENT_TAGS = new Set([
  "svg", "clippath", "defs", "ellipse", "g", "lineargradient", "mask", 
  "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop",
  "circle", "image", "line", "text", "tspan", "use", "foreignobject"
]);

const lowerFirst = (str: string): string => 
  str.length ? str[0].toLowerCase() + str.slice(1) : str;

const toCamelCase = (str: string): string => 
  str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

const getElementTagName = (node: t.JSXElement): string | null => {
  const name = node.openingElement.name;
  return t.isJSXIdentifier(name) ? name.name : null;
};

const jsxName = (n: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string => {
  if (t.isJSXIdentifier(n)) return n.name;
  if (t.isJSXMemberExpression(n)) 
    return `${jsxName(n.object as any)}.${jsxName(n.property as any)}`;
  if (t.isJSXNamespacedName(n)) 
    return `${n.namespace.name}:${n.name.name}`;
  return "Unknown";
};

const isLiteralLike = (n: t.Node | null | undefined): n is t.Literal =>
  !!n && (t.isStringLiteral(n) || t.isNumericLiteral(n) || 
          t.isBooleanLiteral(n) || t.isNullLiteral(n));
function getUniqueName(
  base: string,
  used: Set<string>,
  prog: NodePath<t.Program>
): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate) || prog.scope.hasBinding(candidate) || 
         prog.scope.hasReference(candidate)) {
    candidate = `${base}${suffix++}`;
  }
  used.add(candidate);
  return candidate;
}
function createSignature(node: t.JSXElement): string {
  const attrSig = (attr: t.JSXAttribute | t.JSXSpreadAttribute): string => {
    if (t.isJSXSpreadAttribute(attr)) return "{...}";
    if (!t.isJSXAttribute(attr)) return "";
    
    const key = t.isJSXIdentifier(attr.name) ? attr.name.name : "ns";
    if (!attr.value) return `${key}=true`;
    if (t.isStringLiteral(attr.value)) return `${key}=str`;
    if (t.isJSXExpressionContainer(attr.value)) {
      const expr = attr.value.expression;
      return isLiteralLike(expr) ? `${key}=lit` : `${key}=${expr.type}`;
    }
    return `${key}=elem`;
  };

  const childSig = (ch: JSXChildNode): string => {
    if (t.isJSXText(ch)) return ch.value.trim() ? "txt" : "ws";
    if (t.isJSXExpressionContainer(ch)) {
      const expr = ch.expression;
      return isLiteralLike(expr) ? "lit" : expr.type;
    }
    if (t.isJSXElement(ch)) return createSignature(ch);
    if (t.isJSXFragment(ch)) return "<>";
    return "other";
  };

  const name = jsxName(node.openingElement.name);
  const attrs = node.openingElement.attributes.map(attrSig).join("|");
  const kids = node.children.map(childSig).join(",");
  return `${name}[${attrs}](${kids})`;
}

function getAttrLiteral(attr: t.JSXAttribute): t.Expression | null {
  if (!attr.value) return t.booleanLiteral(true);
  if (t.isStringLiteral(attr.value)) return attr.value;
  if (t.isJSXExpressionContainer(attr.value)) {
    const ex = attr.value.expression;
    if (isLiteralLike(ex)) return ex;
  }
  return null;
}

function getChildLiteral(ch: JSXChildNode): t.Expression | null {
  if (t.isJSXText(ch)) {
    const trimmed = ch.value.trim();
    return trimmed ? t.stringLiteral(trimmed) : null;
  }
  if (t.isJSXExpressionContainer(ch) && isLiteralLike(ch.expression)) {
    return ch.expression;
  }
  return null;
}

function hasMeaningfulContent(node: t.JSXElement): boolean {
  const meaningfulChildren = node.children.filter(ch => {
    if (t.isJSXText(ch)) return ch.value.trim().length > 0;
    if (t.isJSXElement(ch)) return true;
    if (t.isJSXExpressionContainer(ch)) return !t.isJSXEmptyExpression(ch.expression);
    return false;
  });
  
  return meaningfulChildren.length > 1 || 
         meaningfulChildren.some(ch => t.isJSXText(ch)) ||
         node.openingElement.attributes.length > 3;
}

function findVariableSites(a: t.JSXElement, b: t.JSXElement): VarSite[] {
  const sites: VarSite[] = [];
  const propKeyCount = new Map<string, number>();

  const getUniquePropKey = (base: string): string => {
    const count = propKeyCount.get(base) || 0;
    propKeyCount.set(base, count + 1);
    return count === 0 ? base : `${base}${count + 1}`;
  };

  function walk(aNode: t.JSXElement, bNode: t.JSXElement, path: number[]) {
    const aAttrs = aNode.openingElement.attributes.filter(t.isJSXAttribute);
    const bAttrs = bNode.openingElement.attributes.filter(t.isJSXAttribute);

    for (let i = 0; i < Math.min(aAttrs.length, bAttrs.length); i++) {
      const aa = aAttrs[i];
      const bb = bAttrs[i];
      if (!aa || !bb || !t.isJSXIdentifier(aa.name) || !t.isJSXIdentifier(bb.name)) continue;
      if (aa.name.name !== bb.name.name) continue;

      const av = getAttrLiteral(aa);
      const bv = getAttrLiteral(bb);
      
      if (av && bv && generate(av).code !== generate(bv).code) {
        const attrName = aa.name.name;
        const propKey = getUniquePropKey(toCamelCase(attrName));
        sites.push({ kind: "attr", propKey, path: [...path], attrName });
      }
    }

    const minLen = Math.min(aNode.children.length, bNode.children.length);
    for (let i = 0; i < minLen; i++) {
      const ca = aNode.children[i];
      const cb = bNode.children[i];
      const nextPath = [...path, i];

      if (t.isJSXText(ca) && t.isJSXText(cb)) {
        const ta = ca.value.trim();
        const tb = cb.value.trim();
        if (ta && tb && ta !== tb) {
          const propKey = getUniquePropKey(`text${nextPath.join("")}`);
          sites.push({ kind: "text", propKey, path: nextPath });
        }
        continue;
      }

      if (t.isJSXExpressionContainer(ca) && t.isJSXExpressionContainer(cb)) {
        const la = getChildLiteral(ca);
        const lb = getChildLiteral(cb);
        if (la && lb && generate(la).code !== generate(lb).code) {
          const propKey = getUniquePropKey(`text${nextPath.join("")}`);
          sites.push({ kind: "text", propKey, path: nextPath });
        }
        continue;
      }

      if (t.isJSXElement(ca) && t.isJSXElement(cb)) {
        walk(ca, cb, nextPath);
      }
    }
  }

  walk(a, b, []);
  return sites;
}

function navigateToPath(root: t.JSXElement, path: number[]): 
  { parent: t.JSXElement; index: number } | null {
  let current = root;
  for (let i = 0; i < path.length - 1; i++) {
    const ch = current.children[path[i]];
    if (!t.isJSXElement(ch)) return null;
    current = ch;
  }
  return { parent: current, index: path[path.length - 1] ?? -1 };
}

function extractValue(node: t.JSXElement, site: VarSite): t.Expression {
  const loc = navigateToPath(node, site.path);
  if (!loc) return t.stringLiteral("");

  if (site.kind === "text") {
    const ch = loc.parent.children[loc.index];
    const literal = ch ? getChildLiteral(ch) : null;
    return literal || t.stringLiteral("");
  }

  // attr kind
  const target = loc.index < 0 ? loc.parent : loc.parent.children[loc.index];
  if (!t.isJSXElement(target)) return t.stringLiteral("");
  
  const attr = target.openingElement.attributes
    .filter(t.isJSXAttribute)
    .find(a => t.isJSXIdentifier(a.name) && a.name.name === site.attrName);
  
  return attr ? (getAttrLiteral(attr) || t.stringLiteral("")) : t.stringLiteral("");
}

// Replace value with prop reference
function replaceWithProp(template: t.JSXElement, site: VarSite) {
  const loc = navigateToPath(template, site.path);
  if (!loc) return;

  const propId = t.identifier(site.propKey);

  if (site.kind === "text") {
    loc.parent.children[loc.index] = t.jsxExpressionContainer(propId);
    return;
  }

  // attr kind
  const target = loc.index < 0 ? loc.parent : loc.parent.children[loc.index];
  if (!t.isJSXElement(target)) return;
  
  const attr = target.openingElement.attributes
    .filter(t.isJSXAttribute)
    .find(a => t.isJSXIdentifier(a.name) && a.name.name === site.attrName);
  
  if (attr) {
    attr.value = t.jsxExpressionContainer(propId);
  }
}

// Build component from template
function collectExpressionRefs(node: t.JSXElement): Set<string> {
  const refs = new Set<string>();

  function visitNode(n: t.Node) {
    if (t.isIdentifier(n)) {
      refs.add(n.name);
    } else if (t.isJSXExpressionContainer(n)) {
      if (t.isIdentifier(n.expression)) {
        refs.add(n.expression.name);
      }
    }

    // Traverse children
    for (const key of Object.keys(n)) {
      const value = (n as any)[key];
      if (Array.isArray(value)) {
        value.forEach(v => v && typeof v === 'object' && visitNode(v));
      } else if (value && typeof value === 'object' && value.type) {
        visitNode(value);
      }
    }
  }

  visitNode(node);
  return refs;
}

function createComponent(
  name: string,
  example: t.JSXElement,
  sites: VarSite[]
): t.FunctionDeclaration {
  const template = t.cloneNode(example, true) as t.JSXElement;
  sites.forEach(site => replaceWithProp(template, site));

  // Collect all expression references used in the template
  const usedRefs = collectExpressionRefs(template);

  // Add any expression references as additional props (for things like className that come from parent)
  const additionalProps = Array.from(usedRefs)
    .filter(ref => !sites.some(s => s.propKey === ref)); // Don't duplicate existing props

  const allPropKeys = [
    ...sites.map(s => s.propKey),
    ...additionalProps
  ];

  const propsPattern = t.objectPattern(
    allPropKeys.map(key => t.objectProperty(t.identifier(key), t.identifier(key), false, true))
  );
  propsPattern.typeAnnotation = t.tsTypeAnnotation(t.tsAnyKeyword());

  return t.functionDeclaration(
    t.identifier(name),
    [propsPattern as any],
    t.blockStatement([t.returnStatement(template)])
  );
}

function createInstance(
  original: t.JSXElement,
  compName: string,
  sites: VarSite[],
  additionalRefs: Set<string> = new Set()
): t.JSXElement {
  const attrs = sites.map(site =>
    t.jsxAttribute(
      t.jsxIdentifier(site.propKey),
      t.jsxExpressionContainer(extractValue(original, site))
    )
  );

  // Add additional referenced identifiers as passthrough props
  additionalRefs.forEach(ref => {
    attrs.push(
      t.jsxAttribute(
        t.jsxIdentifier(ref),
        t.jsxExpressionContainer(t.identifier(ref))
      )
    );
  });

  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(compName), attrs, true),
    null,
    [],
    true
  );
}

// Check if indices are consecutive
function areConsecutive(indices: number[]): boolean {
  if (indices.length === 0) return false;
  const sorted = [...indices].sort((a, b) => a - b);
  return sorted.every((val, i) => i === 0 || val === sorted[i - 1]! + 1);
}

export function transformJsx(
  code: string,
  options: Options = {}
): { code: string; changed: boolean } {
  const { componentName = "ExtractedItem", preferMap = false, minRepeats = 2 } = options;

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  let changed = false;
  const usedNames = new Set<string>();
  const generatedComponents = new Set<string>();

  traverse(ast, {
    JSXElement(path) {
      // Skip SVG elements and generated components
      const tagName = getElementTagName(path.node);
      if (tagName && (SKIP_AUTO_COMPONENT_TAGS.has(tagName.toLowerCase()) || 
          generatedComponents.has(tagName))) {
        return;
      }

      // Skip if parent is SVG or SVG-related element
      const parentNode = path.parentPath?.node;
      if (t.isJSXElement(parentNode)) {
        const parentTag = getElementTagName(parentNode);
        if (parentTag && (parentTag.toLowerCase() === 'svg' || 
            SKIP_AUTO_COMPONENT_TAGS.has(parentTag.toLowerCase()))) {
          return;
        }
      }

      // Only process elements with JSX parent
      if (!t.isJSXElement(parentNode)) return;
      const container = parentNode as t.JSXElement;

      // Get JSX children only
      const jsxChildren = container.children.filter(t.isJSXElement) as t.JSXElement[];
      if (jsxChildren.length < minRepeats) return;

      // Group by signature
      const groups = new Map<string, { nodes: t.JSXElement[]; indices: number[] }>();
      container.children.forEach((ch, idx) => {
        if (!t.isJSXElement(ch)) return;
        const sig = createSignature(ch);
        const group = groups.get(sig) || { nodes: [], indices: [] };
        group.nodes.push(ch);
        group.indices.push(idx);
        groups.set(sig, group);
      });

      // Find largest group with enough repeats
      const bestGroup = Array.from(groups.values())
        .filter(g => g.nodes.length >= minRepeats)
        .sort((a, b) => b.nodes.length - a.nodes.length)[0];

      if (!bestGroup) return;

      const [first, second] = bestGroup.nodes;
      if (!first || !second) return;

      // Skip if the repeated elements themselves are already custom component instances
      // (no point creating ExtractedItem3 that wraps ExtractedItem2)
      const firstTag = getElementTagName(first);
      if (firstTag && /^[A-Z]/.test(firstTag)) {
        return; // Already a component, don't wrap it
      }

      const varSites = findVariableSites(first, second);
      
      // Need at least some variation
      if (varSites.length === 0) return;
      
      // Skip if it's just a single component reference with props (passthrough pattern)
      const firstChildren = first.children.filter(ch => {
        if (t.isJSXText(ch)) return ch.value.trim().length > 0;
        return t.isJSXElement(ch) || t.isJSXExpressionContainer(ch);
      });
      
      // Check for passthrough pattern: single child that's a custom component
      if (firstChildren.length === 1 && t.isJSXElement(firstChildren[0])) {
        const childTag = getElementTagName(firstChildren[0]);
        // Skip if child is a custom component (starts with uppercase)
        if (childTag && /^[A-Z]/.test(childTag)) {
          return;
        }
      }
      
      // Skip if elements don't have meaningful content (avoid other wrappers)
      if (!hasMeaningfulContent(first)) return;

      const prog = path.findParent(p => p.isProgram()) as NodePath<t.Program> | null;
      if (!prog) return;

      const compName = getUniqueName(componentName, usedNames, prog);
      generatedComponents.add(compName);

      const compDecl = createComponent(compName, first, varSites);
      const [compPath] = prog.unshiftContainer("body", compDecl);

      // Collect additional refs from the template for passing through
      const template = t.cloneNode(first, true) as t.JSXElement;
      varSites.forEach(site => replaceWithProp(template, site));
      const usedRefs = collectExpressionRefs(template);
      const additionalRefs = new Set(
        Array.from(usedRefs).filter(ref => !varSites.some(s => s.propKey === ref))
      );

      if (preferMap && areConsecutive(bestGroup.indices)) {
        const items = bestGroup.nodes.map(node =>
          t.objectExpression(
            varSites.map(s => t.objectProperty(t.identifier(s.propKey), extractValue(node, s)))
          )
        );

        const arrName = getUniqueName(`${lowerFirst(compName)}Data`, usedNames, prog);
        const arrDecl = t.variableDeclaration("const", [
          t.variableDeclarator(t.identifier(arrName), t.arrayExpression(items))
        ]);
        compPath.insertAfter(arrDecl);

        const mapExpr = t.jsxExpressionContainer(
          t.callExpression(
            t.memberExpression(t.identifier(arrName), t.identifier("map")),
            [t.arrowFunctionExpression(
              [t.identifier("d"), t.identifier("i")],
              t.jsxElement(
                t.jsxOpeningElement(
                  t.jsxIdentifier(compName),
                  [
                    t.jsxSpreadAttribute(t.identifier("d")),
                    t.jsxAttribute(t.jsxIdentifier("key"), t.jsxExpressionContainer(t.identifier("i")))
                  ],
                  true
                ),
                null,
                [],
                true
              )
            )]
          )
        );

        const [start, end] = [bestGroup.indices[0]!, bestGroup.indices[bestGroup.indices.length - 1]!];
        container.children.splice(start, end - start + 1, mapExpr);
      } else {
        // Replace individual instances
        container.children = container.children.map(ch =>
          t.isJSXElement(ch) && bestGroup.nodes.includes(ch)
            ? createInstance(ch, compName, varSites, additionalRefs)
            : ch
        );
      }

      changed = true;
      path.skip();
    },
  });

  const output = generate(ast, { jsescOption: { minimal: true } });
  return { code: output.code, changed };
}