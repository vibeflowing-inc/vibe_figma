import type { Config } from 'tailwindcss';
import { TailwindConverter } from '../css-to-tailwind';
import type { TailwindNode } from '../css-to-tailwind/tailwind-nodes-manager';
import { isResolvedTailwindNode } from '../css-to-tailwind/tailwind-nodes-manager';

export interface TailwindConversionResult {
  tailwindClasses: Map<string, string[]>;
  fallbackCSS: string;
  unsupportedDeclarations: Map<string, string[]>;
}

export class FigmaToTailwindConverter {
  private converter: TailwindConverter;
  private tailwindClasses: Map<string, string[]> = new Map();
  private unsupportedDeclarations: Map<string, string[]> = new Map();

  constructor(config?: Config) {
    this.converter = new TailwindConverter({
      tailwindConfig: config || ({ content: [] } as Config),
      arbitraryPropertiesIsEnabled: false,
    });
  }

  /**
   * Convert CSS to Tailwind classes
   * Returns mapping of original class selectors to Tailwind classes
   * and collects unsupported declarations for fallback styles
   */
  async convertCSSToTailwind(css: string): Promise<TailwindConversionResult> {
    try {
      const result = await this.converter.convertCSS(css);

      this.extractTailwindClasses(result.nodes);
      this.extractUnsupportedDeclarations(result.convertedRoot);

      const fallbackCSS = this.generateFallbackCSS();

      return {
        tailwindClasses: this.tailwindClasses,
        fallbackCSS,
        unsupportedDeclarations: this.unsupportedDeclarations,
      };
    } catch (error) {
      console.warn('Tailwind conversion failed, using fallback:', error);
      return {
        tailwindClasses: new Map(),
        fallbackCSS: css,
        unsupportedDeclarations: new Map(),
      };
    }
  }

  /**
   * Extract Tailwind classes from converted nodes
   * Maps original class names (without dot) to their Tailwind classes
   */
  private extractTailwindClasses(nodes: TailwindNode[]) {
    for (const node of nodes) {
      const isResolved = isResolvedTailwindNode(node);
      const selector = isResolved ? node.rule.selector : node.key;

      // Extract class name from selector (remove leading dot if it's a class selector)
      const className = this.extractClassNameFromSelector(selector);

      if (className && node.tailwindClasses.length > 0) {
        this.tailwindClasses.set(className, node.tailwindClasses);
      }
    }
  }

  /**
   * Extract class name from CSS selector
   * Handles selectors like ".vibeflow-button-123" -> "vibeflow-button-123"
   */
  private extractClassNameFromSelector(selector: string): string {
    // For simple class selectors like ".vibeflow-button-123"
    if (selector.startsWith('.')) {
      return selector.substring(1);
    }

    // For complex selectors, try to extract the main class
    // e.g., ".container .button" -> "button" (last class)
    const parts = selector.split(' ');
    const lastPart = parts[parts.length - 1];

    if (lastPart?.startsWith('.')) {
      return lastPart.substring(1);
    }

    return selector;
  }

  /**
   * Extract unsupported CSS declarations from the converted root
   * These are declarations that couldn't be converted to Tailwind
   */
  private extractUnsupportedDeclarations(root: any) {
    root.walkRules((rule: any) => {
      const unsupported: string[] = [];

      rule.walkDecls((decl: any) => {
        unsupported.push(`${decl.prop}: ${decl.value}`);
      });

      if (unsupported.length > 0) {
        this.unsupportedDeclarations.set(rule.selector, unsupported);
      }
    });
  }

  /**
   * Generate CSS for unsupported declarations
   * Uses data attributes to scope styles to specific elements
   */
  private generateFallbackCSS(): string {
    if (this.unsupportedDeclarations.size === 0) {
      return '';
    }

    let css = '\n/* Fallback styles for Tailwind-unsupported properties */\n';

    for (const [selector, declarations] of this.unsupportedDeclarations) {
      if (declarations.length === 0) continue;

      css += `${selector} {\n`;
      for (const decl of declarations) {
        css += `  ${decl};\n`;
      }
      css += '}\n';
    }

    return css;
  }

  /**
   * Map generated class names to Tailwind classes for a specific element
   * Returns array of Tailwind classes, or original classes if not convertible
   */
  getTailwindClassesForSelector(selector: string): string[] {
    const classNames = this.tailwindClasses.get(selector) || [];
    return classNames;
  }

  /**
   * Get all Tailwind class mappings
   */
  getAllTailwindClasses(): Map<string, string[]> {
    return this.tailwindClasses;
  }

  /**
   * Get unsupported declarations
   */
  getUnsupportedDeclarations(): Map<string, string[]> {
    return this.unsupportedDeclarations;
  }

  /**
   * Check if a specific selector has Tailwind classes
   */
  hasTailwindClasses(selector: string): boolean {
    const classes = this.tailwindClasses.get(selector);
    return classes ? classes.length > 0 : false;
  }
}

/**
 * Utility function to replace generated class names in HTML with Tailwind classes
 * Maps original generated classes to their Tailwind equivalents
 */
export function replaceClassesWithTailwind(
  html: string,
  generatedClassToTailwind: Map<string, string[]>
): string {
  let result = html;

  for (const [generatedClass, tailwindClasses] of generatedClassToTailwind) {
    if (tailwindClasses.length === 0) continue;

    const classRegex = new RegExp(`class="([^"]*)?${generatedClass}([^"]*)?"`, 'g');
    const replacement = `class="$1${tailwindClasses.join(' ')}$2"`;

    result = result.replace(classRegex, replacement);
  }

  return result;
}

/**
 * Utility to merge classes while avoiding duplicates
 */
export function mergeClasses(...classLists: (string | string[] | undefined)[]): string {
  const classes = new Set<string>();

  for (const list of classLists) {
    if (!list) continue;
    if (Array.isArray(list)) {
      list.forEach(cls => classes.add(cls));
    } else {
      list.split(/\s+/).forEach(cls => {
        if (cls) classes.add(cls);
      });
    }
  }

  return Array.from(classes).join(' ');
}

/**
 * Extract and convert SVG inline colors to CSS classes
 * Handles fill="rgb(...)" and stroke="rgb(...)" attributes
 */
export function extractSVGColorsToCSS(html: string): { html: string; css: string } {
  const svgFillRegex = /fill="rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)"/g;
  const svgStrokeRegex = /stroke="rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)"/g;

  let modifiedHtml = html;
  let cssDeclarations = new Set<string>();

  // Extract fill colors
  let match;
  while ((match = svgFillRegex.exec(html)) !== null) {
    const r = match[1];
    const g = match[2];
    const b = match[3];
    const rgbValue = `rgb(${r}, ${g}, ${b})`;

    cssDeclarations.add(`fill: ${rgbValue};`);
  }

  // Extract stroke colors
  while ((match = svgStrokeRegex.exec(html)) !== null) {
    const r = match[1];
    const g = match[2];
    const b = match[3];
    const rgbValue = `rgb(${r}, ${g}, ${b})`;

    cssDeclarations.add(`stroke: ${rgbValue};`);
  }

  const css = Array.from(cssDeclarations).join('\n');

  return { html: modifiedHtml, css };
}
