import type { Container } from 'postcss';

export function detectIndent(root: Container<any>) {
  if (root.raws.indent) return root.raws.indent;

  let detectedIndent = '    ';
  root.walk(node => {
    let p = node.parent;
    if (p && p !== root && p.parent && p.parent === root) {
      if (typeof node.raws.before !== 'undefined') {
        let parts = node.raws.before.split('\n');
        detectedIndent = parts[parts.length - 1];
        detectedIndent = detectedIndent.replace(/\S/g, '');
        return false;
      }
    }
  });

  return detectedIndent;
}
