import type { FigmaToHTMLOptions } from "./types";
import { FigmaToTailwindConverter } from "./figma-to-tailwind";
import HTMLtoJSX from "htmltojsx";
import { generateComponentName } from "./utils/component-name";
import { transformJsx } from "./transform-jsx";

export class FigmaToHTML {
  options: FigmaToHTMLOptions & Record<string, any>;
  styles: Map<string, Record<string, string | number>>;
  fontFamilies: Set<string>;
  zIndexCounter: number;
  imageRefs: Set<string>;
  imageNodes: Map<string, string>;
  uniqueIdCounter: number;
  rootWidth: number | null;
  tailwindConverter: FigmaToTailwindConverter | null;
  returnTSX: boolean = true;

  constructor(options: Partial<FigmaToHTMLOptions> = {}) {
    this.options = {
      useAbsolutePositioning: options.useAbsolutePositioning ?? true,
      generateClasses: options.generateClasses ?? true,
      classPrefix: options.classPrefix ?? "vibeflow-",
      includeFonts: options.includeFonts ?? true,
      imageUrls: options.imageUrls ?? {},
      responsive: options.responsive ?? true,
      useTailwind: options.useTailwind ?? false,
      keepFallbackStyles: options.keepFallbackStyles ?? true,
      returnTSX: options.returnTSX ?? true,
      ...options,
    };
    this.styles = new Map();
    this.fontFamilies = new Set();
    this.zIndexCounter = 1;
    this.imageRefs = new Set();
    this.imageNodes = new Map();
    this.uniqueIdCounter = 0;
    this.rootWidth = null;
    this.tailwindConverter = this.options.useTailwind
      ? new FigmaToTailwindConverter(options.tailwindConfig)
      : null;
  }

  async convert(figmaNode: any) {
    if (!figmaNode) return "";

    this.zIndexCounter = 1;
    const html = this.convertNode(figmaNode);
    let css = this.generateCSS();
    const fonts = this.generateFontImports();

    let finalHtml = html;
    let tailwindCSS = "";

    // Convert to Tailwind if enabled
    if (this.options.useTailwind && this.tailwindConverter) {
      const conversionResult =
        await this.tailwindConverter.convertCSSToTailwind(css);

      // Replace generated classes with Tailwind classes in HTML
      finalHtml = this.replaceCSSClassesWithTailwind(
        html,
        conversionResult.tailwindClasses,
      );

      // Keep fallback CSS for unsupported properties
      if (this.options.keepFallbackStyles && conversionResult.fallbackCSS) {
        tailwindCSS = conversionResult.fallbackCSS;
      }

      css = "";
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(figmaNode.name || "Figma Design")}</title>
  ${fonts}
  ${this.options.useTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ""}
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #f5f5f5;
    }

    /* Responsive container for root element */
    body > div:first-child {
      max-width: 100%;
      margin: 0 auto;
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
      body > div:first-child {
        min-height: auto !important;
      }

      /* Scale down absolute elements on mobile */
      [data-node-id] {
        font-size: 0.9rem;
      }
    }

    @media (max-width: 480px) {
      [data-node-id] {
        font-size: 0.8rem;
      }
    }

${css}${tailwindCSS}
  </style>
</head>
<body>
${finalHtml}
</body>
</html>`;
  }

  async convertJSX(figmaNode: any, noTailwindImport = false) {
    this.zIndexCounter = 1;
    const html = this.convertNode(figmaNode);
    let css = this.generateCSS();
    const fonts = this.generateFontImports();

    let finalHtml = html;
    let tailwindCSS = "";

    // Convert to Tailwind if enabled
    if (this.options.useTailwind && this.tailwindConverter) {
      const conversionResult =
        await this.tailwindConverter.convertCSSToTailwind(css);

      // Replace generated classes with Tailwind classes in HTML
      finalHtml = this.replaceCSSClassesWithTailwind(
        html,
        conversionResult.tailwindClasses,
      );

      // Keep fallback CSS for unsupported properties
      if (this.options.keepFallbackStyles && conversionResult.fallbackCSS) {
        tailwindCSS = conversionResult.fallbackCSS;
      }

      css = "";
    }

    const converter = new HTMLtoJSX({
      createClass: false,
      outputClassName: "div",
    });
    const jsx = converter.convert(finalHtml);
    const tJSX =
      transformJsx(`const ${generateComponentName(figmaNode.name)} = () => {
    return (
    ${jsx}
    );
  };

  export default ${generateComponentName(figmaNode.name)};`);

    return {
      componentName: generateComponentName(figmaNode.name),
      jsx: tJSX.code,
      fonts,
      css: `${
        noTailwindImport
          ? ""
          : "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n"
      }
  ${css}${tailwindCSS}`,
    };
  }

  convertNode(
    node: any,
    parentContext: { bounds?: any; node?: any } | null = null,
  ) {
    if (!node || !node.type) return "";
    if (node.visible === false) return "";

    const parentBounds = parentContext?.bounds ?? null;
    const parentNode = parentContext?.node ?? null;

    const className = this.generateClassName(node);
    const styles = this.getNodeStyles(node, parentBounds, parentNode);

    if (node.type === "TEXT") {
      const tagName = this.getTextTag(node);
      if (tagName === "h1" || tagName === "h2" || tagName === "span") {
        delete styles.height;
        delete styles.minHeight;
      }
    }

    if (this.options.generateClasses) {
      this.styles.set(className, styles);
    }

    const inlineStyles = this.options.generateClasses
      ? ""
      : ` style="${this.stylesToString(styles)}"`;
    const classAttr = this.options.generateClasses
      ? ` class="${className}"`
      : "";

    switch (node.type) {
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
        return this.convertFrame(
          node,
          className,
          classAttr,
          inlineStyles,
          styles,
        );
      case "GROUP":
        return this.convertGroup(
          node,
          className,
          classAttr,
          inlineStyles,
          styles,
        );
      case "TEXT":
        return this.convertText(
          node,
          className,
          classAttr,
          inlineStyles,
          styles,
        );
      case "VECTOR":
      case "RECTANGLE":
      case "ELLIPSE":
      case "STAR":
      case "POLYGON":
      case "LINE":
        return this.convertVector(
          node,
          className,
          classAttr,
          inlineStyles,
          styles,
        );
      default:
        return this.convertGeneric(
          node,
          className,
          classAttr,
          inlineStyles,
          styles,
        );
    }
  }

  convertFrame(
    node: any,
    className: string,
    classAttr: string,
    inlineStyles: string,
    styles: any,
  ) {
    const children = node.children || [];
    const childrenHTML = children
      .map((child: any) =>
        this.convertNode(child, { bounds: node.absoluteBoundingBox, node }),
      )
      .filter((html: string) => html)
      .join("\n");

    const imageTag = this.generateImageTag(node, styles);

    // Determine the correct tag (button or div)
    const tag = this.isButton(node) ? "button" : "div";

    if (imageTag) {
      return `<${tag}${classAttr}${inlineStyles}>
${imageTag}
${childrenHTML}
</${tag}>`;
    }

    return `<${tag}${classAttr}${inlineStyles}>
${childrenHTML}
</${tag}>`;
  }

  convertGroup(
    node: any,
    className: string,
    classAttr: string,
    inlineStyles: string,
    styles: any,
  ) {
    const children = node.children || [];
    const childrenHTML = children
      .map((child: any) =>
        this.convertNode(child, { bounds: node.absoluteBoundingBox, node }),
      )
      .filter((html: string) => html)
      .join("\n");

    const imageTag = this.generateImageTag(node, styles);

    // Determine the correct tag (button or div)
    const tag = this.isButton(node) ? "button" : "div";

    if (imageTag) {
      return `<${tag}${classAttr}${inlineStyles}>
${imageTag}
${childrenHTML}
</${tag}>`;
    }

    return `<${tag}${classAttr}${inlineStyles}>
${childrenHTML}
</${tag}>`;
  }

  convertText(
    node: any,
    className: string,
    classAttr: string,
    inlineStyles: string,
    styles: any,
  ) {
    const text = this.escapeHtml(node.characters || "");
    const tag = this.getTextTag(node);

    if (node.style?.fontFamily) {
      this.fontFamilies.add(node.style.fontFamily);
    }

    return `<${tag}${classAttr}${inlineStyles}>${text}</${tag}>`;
  }

  convertVector(
    node: any,
    className: string,
    classAttr: string,
    inlineStyles: string,
    styles: any,
  ) {
    if (this.shouldRenderAsSvg(node)) {
      const workingStyles = { ...styles };
      this.stripVectorFillStyles(workingStyles);

      let svgInlineStyles = "";
      if (this.options.generateClasses) {
        this.styles.set(className, workingStyles);
      } else {
        svgInlineStyles = ` style="${this.stylesToString(workingStyles)}"`;
      }

      const svgMarkup = this.generateVectorSVG(
        node,
        classAttr,
        svgInlineStyles,
      );
      if (svgMarkup) {
        Object.assign(styles, workingStyles);
        return svgMarkup;
      }

      if (this.options.generateClasses) {
        this.styles.set(className, styles);
      }
    }
    const imageTag = this.generateImageTag(node, styles);

    if (imageTag) {
      return `<div${classAttr}${inlineStyles}>${imageTag}</div>`;
    }

    return `<div${classAttr}${inlineStyles}></div>`;
  }

  shouldRenderAsSvg(node: any) {
    if (!node || !node.type) return false;
    const svgTypes = new Set([
      "VECTOR",
      "STAR",
      "POLYGON",
      "ELLIPSE",
      "LINE",
      "BOOLEAN_OPERATION",
      "RECTANGLE",
    ]);
    if (!svgTypes.has(node.type)) return false;

    const hasFillGeometry =
      Array.isArray(node.fillGeometry) && node.fillGeometry.length > 0;
    const hasStrokeGeometry =
      Array.isArray(node.strokeGeometry) && node.strokeGeometry.length > 0;

    return hasFillGeometry || hasStrokeGeometry;
  }

  stripVectorFillStyles(styles: any = {}) {
    if (!styles) return;
    delete styles.background;
    delete styles.backgroundColor;
    delete styles.backgroundImage;
    delete styles.border;
    delete styles.outline;
  }

  generateVectorSVG(node: any, classAttr: string, inlineStyles: string) {
    const bounds = node.absoluteBoundingBox;
    if (!bounds) {
      return null;
    }

    const fillGeometry = Array.isArray(node.fillGeometry)
      ? node.fillGeometry
      : [];
    const strokeGeometry = Array.isArray(node.strokeGeometry)
      ? node.strokeGeometry
      : [];

    const fillPath = this.combineGeometryPaths(fillGeometry);
    const fillRule = this.getWindingRule(fillGeometry);
    const { elements: fillElements, defs: fillDefs } = this.buildFillElements(
      node,
      fillPath,
      fillRule,
      bounds,
    );

    const strokePath = this.combineGeometryPaths(strokeGeometry) || fillPath;
    const strokeRule = this.getWindingRule(strokeGeometry) || fillRule;
    const strokeResult = this.buildStrokeElements(
      node,
      strokePath,
      strokeRule,
      bounds,
    );

    const defs = [...fillDefs, ...strokeResult.defs];
    const shapes = [...fillElements, ...strokeResult.elements].filter(Boolean);

    if (shapes.length === 0) {
      return null;
    }

    const defsMarkup =
      defs.length > 0
        ? `  <defs>\n${defs.map((def) => `    ${def}`).join("\n")}\n  </defs>\n`
        : "";

    const width = this.formatNumber(bounds.width);
    const height = this.formatNumber(bounds.height);
    const geometryBounds = this.getGeometryBounds([fillPath, strokePath]);
    const viewBoxX = geometryBounds
      ? this.formatNumber(geometryBounds.minX)
      : "0";
    const viewBoxY = geometryBounds
      ? this.formatNumber(geometryBounds.minY)
      : "0";
    const viewBoxWidth = geometryBounds
      ? this.formatNumber(
          Math.max(0, geometryBounds.maxX - geometryBounds.minX),
        )
      : width;
    const viewBoxHeight = geometryBounds
      ? this.formatNumber(
          Math.max(0, geometryBounds.maxY - geometryBounds.minY),
        )
      : height;

    const content = shapes.map((line) => `  ${line}`).join("\n");
    const containsImage = shapes.some((line) => line.includes("<image "));
    const xlinkNamespace = containsImage
      ? ' xmlns:xlink="http://www.w3.org/1999/xlink"'
      : "";

    return `<svg${classAttr}${inlineStyles} xmlns="http://www.w3.org/2000/svg"${xlinkNamespace} width="${width}" height="${height}" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" preserveAspectRatio="none">\n${defsMarkup}${content}\n</svg>`;
  }

  combineGeometryPaths(geometry: any[] = []) {
    if (!Array.isArray(geometry) || geometry.length === 0) {
      return null;
    }
    return geometry
      .filter((segment) => segment && typeof segment.path === "string")
      .map((segment) => segment.path.trim())
      .join(" ");
  }

  getGeometryBounds(paths: Array<string | null>) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };

    const updateBounds = (x: number, y: number) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    };

    const valueToNumber = (value: string) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const arcToBounds = (
      current: { x: number; y: number },
      next: { x: number; y: number },
      flags: number[],
    ) => {
      updateBounds(next.x, next.y);
      updateBounds(current.x, current.y);
      if (flags.length >= 2 && (flags[0] !== 0 || flags[1] !== 0)) {
        updateBounds(current.x, next.y);
        updateBounds(next.x, current.y);
      }
    };

    const updateFromPath = (path: string) => {
      const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
      if (!tokens) return;

      let index = 0;
      let command = "";
      let current = { x: 0, y: 0 };
      let start = { x: 0, y: 0 };

      const readNumber = () => {
        if (index >= tokens.length) return null;
        const value = valueToNumber(tokens[index]);
        index += 1;
        return value;
      };

      const readPoint = () => {
        const x = readNumber();
        const y = readNumber();
        if (x === null || y === null) return null;
        return { x, y };
      };

      while (index < tokens.length) {
        const token = tokens[index];
        if (!token) {
          index += 1;
          continue;
        }

        if (/^[a-zA-Z]$/.test(token)) {
          command = token;
          index += 1;
        }

        const isRelative = command === command.toLowerCase();
        const cmd = command.toUpperCase();

        if (cmd === "M") {
          const point = readPoint();
          if (!point) break;
          current = isRelative
            ? { x: current.x + point.x, y: current.y + point.y }
            : point;
          start = { ...current };
          updateBounds(current.x, current.y);
          while (index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index])) {
            const linePoint = readPoint();
            if (!linePoint) break;
            current = isRelative
              ? { x: current.x + linePoint.x, y: current.y + linePoint.y }
              : linePoint;
            updateBounds(current.x, current.y);
          }
          continue;
        }

        if (cmd === "Z") {
          current = { ...start };
          updateBounds(current.x, current.y);
          continue;
        }

        if (cmd === "L") {
          const point = readPoint();
          if (!point) break;
          current = isRelative
            ? { x: current.x + point.x, y: current.y + point.y }
            : point;
          updateBounds(current.x, current.y);
          continue;
        }

        if (cmd === "H") {
          const x = readNumber();
          if (x === null) break;
          current = { x: isRelative ? current.x + x : x, y: current.y };
          updateBounds(current.x, current.y);
          continue;
        }

        if (cmd === "V") {
          const y = readNumber();
          if (y === null) break;
          current = { x: current.x, y: isRelative ? current.y + y : y };
          updateBounds(current.x, current.y);
          continue;
        }

        if (cmd === "C") {
          const points = [readPoint(), readPoint(), readPoint()];
          if (points.some((p) => !p)) break;
          const [c1, c2, end] = points as { x: number; y: number }[];
          const absC1 = isRelative
            ? { x: current.x + c1.x, y: current.y + c1.y }
            : c1;
          const absC2 = isRelative
            ? { x: current.x + c2.x, y: current.y + c2.y }
            : c2;
          const absEnd = isRelative
            ? { x: current.x + end.x, y: current.y + end.y }
            : end;
          updateBounds(absC1.x, absC1.y);
          updateBounds(absC2.x, absC2.y);
          updateBounds(absEnd.x, absEnd.y);
          current = absEnd;
          continue;
        }

        if (cmd === "S") {
          const points = [readPoint(), readPoint()];
          if (points.some((p) => !p)) break;
          const [c2, end] = points as { x: number; y: number }[];
          const absC2 = isRelative
            ? { x: current.x + c2.x, y: current.y + c2.y }
            : c2;
          const absEnd = isRelative
            ? { x: current.x + end.x, y: current.y + end.y }
            : end;
          updateBounds(absC2.x, absC2.y);
          updateBounds(absEnd.x, absEnd.y);
          current = absEnd;
          continue;
        }

        if (cmd === "Q") {
          const points = [readPoint(), readPoint()];
          if (points.some((p) => !p)) break;
          const [c1, end] = points as { x: number; y: number }[];
          const absC1 = isRelative
            ? { x: current.x + c1.x, y: current.y + c1.y }
            : c1;
          const absEnd = isRelative
            ? { x: current.x + end.x, y: current.y + end.y }
            : end;
          updateBounds(absC1.x, absC1.y);
          updateBounds(absEnd.x, absEnd.y);
          current = absEnd;
          continue;
        }

        if (cmd === "T") {
          const point = readPoint();
          if (!point) break;
          const absPoint = isRelative
            ? { x: current.x + point.x, y: current.y + point.y }
            : point;
          updateBounds(absPoint.x, absPoint.y);
          current = absPoint;
          continue;
        }

        if (cmd === "A") {
          const rx = readNumber();
          const ry = readNumber();
          const xAxisRotation = readNumber();
          const largeArc = readNumber();
          const sweep = readNumber();
          const point = readPoint();
          if (
            [rx, ry, xAxisRotation, largeArc, sweep].some((v) => v === null) ||
            !point
          ) {
            break;
          }
          const absPoint = isRelative
            ? { x: current.x + point.x, y: current.y + point.y }
            : point;
          const flags = [
            rx ?? 0,
            ry ?? 0,
            xAxisRotation ?? 0,
            largeArc ?? 0,
            sweep ?? 0,
          ];
          arcToBounds(current, absPoint, flags as number[]);
          current = absPoint;
          continue;
        }

        break;
      }
    };

    paths.filter(Boolean).forEach((path) => updateFromPath(path as string));

    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
      return null;
    }

    return bounds;
  }

  getWindingRule(geometry: any[] = []) {
    if (!Array.isArray(geometry) || geometry.length === 0) {
      return "nonzero";
    }
    const rule = geometry.find(
      (segment) => segment && segment.windingRule,
    )?.windingRule;
    return rule ? rule.toLowerCase() : "nonzero";
  }

  buildFillElements(node: any, pathData: any, fillRule: any, bounds: any) {
    const elements: string[] = [];
    const defs: string[] = [];

    if (!pathData) {
      return { elements, defs };
    }

    const fills: any[] = Array.isArray(node.fills)
      ? node.fills.filter((fill: any) => fill && fill.visible !== false)
      : [];

    if (fills.length === 0) {
      return { elements, defs };
    }

    const clipRuleAttr = fillRule === "evenodd" ? "evenodd" : "nonzero";

    fills.forEach((fill, index) => {
      if (!fill) return;

      if (fill.type === "SOLID") {
        const { color, opacity } = this.colorToSvgComponents(
          fill.color,
          fill.opacity,
        );
        const opacityAttr =
          opacity < 1 ? ` fill-opacity="${this.formatNumber(opacity)}"` : "";
        elements.push(
          `<path d="${pathData}" fill="${color}" fill-rule="${fillRule}"${opacityAttr} />`,
        );
      } else if (fill.type === "GRADIENT_LINEAR") {
        const gradient = this.createLinearGradientDef(
          fill,
          node,
          bounds,
          `fill-${index}`,
        );
        if (gradient) {
          defs.push(gradient.def);
          elements.push(
            `<path d="${pathData}" fill="url(#${gradient.id})" fill-rule="${fillRule}" />`,
          );
        }
      } else if (fill.type === "GRADIENT_RADIAL") {
        const gradient = this.createRadialGradientDef(
          fill,
          node,
          bounds,
          `fill-${index}`,
        );
        if (gradient) {
          defs.push(gradient.def);
          elements.push(
            `<path d="${pathData}" fill="url(#${gradient.id})" fill-rule="${fillRule}" />`,
          );
        }
      } else if (fill.type === "IMAGE") {
        if (fill.imageRef) {
          this.imageRefs.add(fill.imageRef);
          this.imageNodes.set(node.id, fill.imageRef);
        }
        const clipId = this.generateUniqueId(
          `clip-${this.sanitizeId(node.id)}-${index}-`,
        );
        defs.push(
          `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">\n      <path d="${pathData}" clip-rule="${clipRuleAttr}" />\n    </clipPath>`,
        );

        const placeholderWidth = Math.max(1, Math.round(bounds?.width || 100));
        const placeholderHeight = Math.max(
          1,
          Math.round(bounds?.height || 100),
        );

        const imageUrl =
          fill.imageRef && this?.options?.imageUrls?.[fill?.imageRef]
            ? this.options.imageUrls[fill.imageRef]
            : `https://via.placeholder.com/${placeholderWidth}x${placeholderHeight}?text=Image`;

        const x = "0";
        const y = "0";
        const width = this.formatNumber(bounds?.width ?? 0);
        const height = this.formatNumber(bounds?.height ?? 0);
        const preserve = this.mapScaleModeToPreserveAspectRatio(fill.scaleMode);

        elements.push(
          `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${imageUrl}" xlink:href="${imageUrl}" clip-path="url(#${clipId})" preserveAspectRatio="${preserve}" />`,
        );
      }
    });

    return { elements, defs };
  }

  createLinearGradientDef(paint: any, node: any, bounds: any, key: string) {
    if (
      !paint ||
      !Array.isArray(paint.gradientStops) ||
      paint.gradientStops.length === 0
    ) {
      return null;
    }

    const gradientId = this.generateUniqueId(
      `${key || "fill"}-linear-${this.sanitizeId(node.id)}-`,
    );
    const handles = Array.isArray(paint.gradientHandlePositions)
      ? paint.gradientHandlePositions
      : [];
    const start = handles[0] || { x: 0, y: 0 };
    const end = handles[1] || { x: 1, y: 0 };

    const stops = paint.gradientStops.map((stop: any) => {
      const { color, opacity } = this.colorToSvgComponents(
        stop.color,
        paint.opacity,
      );
      const offsetValue = this.formatNumber((stop.position ?? 0) * 100);
      const opacityAttr =
        opacity < 1 ? ` stop-opacity="${this.formatNumber(opacity)}"` : "";
      return `<stop offset="${offsetValue}%" stop-color="${color}"${opacityAttr} />`;
    });

    const gradientDef = `<linearGradient id="${gradientId}" gradientUnits="objectBoundingBox" x1="${this.formatNumber(start.x)}" y1="${this.formatNumber(start.y)}" x2="${this.formatNumber(end.x)}" y2="${this.formatNumber(end.y)}">\n      ${stops.join("\n      ")}\n    </linearGradient>`;

    return { id: gradientId, def: gradientDef };
  }

  createRadialGradientDef(paint: any, node: any, bounds: any, key: string) {
    if (
      !paint ||
      !Array.isArray(paint.gradientStops) ||
      paint.gradientStops.length === 0
    ) {
      return null;
    }

    const gradientId = this.generateUniqueId(
      `${key || "fill"}-radial-${this.sanitizeId(node.id)}-`,
    );
    const handles = Array.isArray(paint.gradientHandlePositions)
      ? paint.gradientHandlePositions
      : [];
    const center = handles[0] || { x: 0.5, y: 0.5 };
    const radiusHandle = handles[1] || { x: 1, y: 0.5 };
    const dx = radiusHandle.x - center.x;
    const dy = radiusHandle.y - center.y;
    const radius = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);

    const stops = paint.gradientStops.map((stop: any) => {
      const { color, opacity } = this.colorToSvgComponents(
        stop.color,
        paint.opacity,
      );
      const offsetValue = this.formatNumber((stop.position ?? 0) * 100);
      const opacityAttr =
        opacity < 1 ? ` stop-opacity="${this.formatNumber(opacity)}"` : "";
      return `<stop offset="${offsetValue}%" stop-color="${color}"${opacityAttr} />`;
    });

    const gradientDef = `<radialGradient id="${gradientId}" gradientUnits="objectBoundingBox" cx="${this.formatNumber(center.x)}" cy="${this.formatNumber(center.y)}" r="${this.formatNumber(radius)}">\n      ${stops.join("\n      ")}\n    </radialGradient>`;

    return { id: gradientId, def: gradientDef };
  }

  mapScaleModeToPreserveAspectRatio(scaleMode: any) {
    switch (scaleMode) {
      case "FIT":
        return "xMidYMid meet";
      case "STRETCH":
        return "none";
      case "TILE":
        return "xMidYMid meet";
      case "FILL":
      default:
        return "xMidYMid slice";
    }
  }

  colorToSvgComponents(color: any = {}, opacity = 1) {
    const r = Math.round((color?.r ?? 0) * 255);
    const g = Math.round((color?.g ?? 0) * 255);
    const b = Math.round((color?.b ?? 0) * 255);
    const alpha = Math.max(0, Math.min(1, (color?.a ?? 1) * (opacity ?? 1)));
    return {
      color: `rgb(${r}, ${g}, ${b})`,
      opacity: alpha,
    };
  }

  mapStrokeCap(cap: any) {
    const value = Array.isArray(cap) ? cap[0] : cap;
    if (!value) return "butt";
    const normalized: any = String(value).toUpperCase();
    const mapping: Record<string, string> = {
      NONE: "butt",
      BUTT: "butt",
      ROUND: "round",
      SQUARE: "square",
      LINE_ARROW: "butt",
      TRIANGLE_ARROW: "butt",
    };
    return mapping[normalized] || normalized.toLowerCase();
  }

  mapStrokeJoin(join: any) {
    if (!join) return "miter";
    const normalized = String(join).toUpperCase();
    const mapping: Record<string, string> = {
      MITER: "miter",
      BEVEL: "bevel",
      ROUND: "round",
    };
    return mapping[normalized] || normalized.toLowerCase();
  }

  sanitizeId(value: string) {
    if (!value) return "id";
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  }

  generateUniqueId(prefix = "id-") {
    this.uniqueIdCounter += 1;
    return `${this.sanitizeId(prefix)}${this.uniqueIdCounter}`;
  }

  formatNumber(value: any) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "0";
    }
    const fixed = value.toFixed(4);
    return fixed.replace(/\.0+$/, "").replace(/(\.[0-9]*[1-9])0+$/, "$1");
  }

  buildStrokeElements(node: any, pathData: any, strokeRule: any, bounds: any) {
    const elements: any[] = [];
    const defs: any[] = [];

    if (!pathData) {
      return { elements, defs };
    }

    const strokes = Array.isArray(node.strokes)
      ? node.strokes.filter((stroke: any) => stroke && stroke.visible !== false)
      : [];
    if (strokes.length === 0) {
      return { elements, defs };
    }

    const strokePaint = strokes[0];
    if (!strokePaint) {
      return { elements, defs };
    }

    const strokeGeometry = Array.isArray(node.strokeGeometry)
      ? node.strokeGeometry.filter(
          (segment: any) => segment && typeof segment.path === "string",
        )
      : [];

    const applyFillPaint = () => {
      if (strokePaint.type === "SOLID") {
        const { color, opacity } = this.colorToSvgComponents(
          strokePaint.color,
          strokePaint.opacity,
        );
        return { paint: color, opacity };
      }
      if (strokePaint.type === "GRADIENT_LINEAR") {
        const gradient = this.createLinearGradientDef(
          strokePaint,
          node,
          bounds,
          "stroke",
        );
        if (gradient) {
          defs.push(gradient.def);
          return { paint: `url(#${gradient.id})`, opacity: 1 };
        }
      }
      if (strokePaint.type === "GRADIENT_RADIAL") {
        const gradient = this.createRadialGradientDef(
          strokePaint,
          node,
          bounds,
          "stroke",
        );
        if (gradient) {
          defs.push(gradient.def);
          return { paint: `url(#${gradient.id})`, opacity: 1 };
        }
      }
      return null;
    };

    if (strokeGeometry.length > 0) {
      const paintResult = applyFillPaint();
      if (!paintResult) {
        return { elements, defs };
      }

      const geometryRule = this.getWindingRule(strokeGeometry);
      const fillOpacityAttr =
        paintResult.opacity < 1
          ? ` fill-opacity="${this.formatNumber(paintResult.opacity)}"`
          : "";

      strokeGeometry.forEach((segment: any) => {
        const segmentRule = segment.windingRule
          ? segment.windingRule.toLowerCase()
          : geometryRule;
        elements.push(
          `<path d="${segment.path}" fill="${paintResult.paint}" fill-rule="${segmentRule}"${fillOpacityAttr} />`,
        );
      });

      return { elements, defs };
    }

    let strokeAttrs = "";

    if (strokePaint.type === "SOLID") {
      const { color, opacity } = this.colorToSvgComponents(
        strokePaint.color,
        strokePaint.opacity,
      );
      strokeAttrs += ` stroke="${color}"`;
      if (opacity < 1) {
        strokeAttrs += ` stroke-opacity="${this.formatNumber(opacity)}"`;
      }
    } else if (strokePaint.type === "GRADIENT_LINEAR") {
      const gradient = this.createLinearGradientDef(
        strokePaint,
        node,
        bounds,
        "stroke",
      );
      if (gradient) {
        defs.push(gradient.def);
        strokeAttrs += ` stroke="url(#${gradient.id})"`;
      }
    } else if (strokePaint.type === "GRADIENT_RADIAL") {
      const gradient = this.createRadialGradientDef(
        strokePaint,
        node,
        bounds,
        "stroke",
      );
      if (gradient) {
        defs.push(gradient.def);
        strokeAttrs += ` stroke="url(#${gradient.id})"`;
      }
    } else {
      return { elements, defs };
    }

    const strokeWeight =
      typeof node.strokeWeight === "number" &&
      Number.isFinite(node.strokeWeight)
        ? node.strokeWeight
        : 1;
    strokeAttrs += ` stroke-width="${this.formatNumber(strokeWeight)}"`;

    if (node.strokeCap) {
      strokeAttrs += ` stroke-linecap="${this.mapStrokeCap(node.strokeCap)}"`;
    }
    if (node.strokeJoin) {
      strokeAttrs += ` stroke-linejoin="${this.mapStrokeJoin(node.strokeJoin)}"`;
    }
    const dashArraySource = Array.isArray(node.strokeDashes)
      ? node.strokeDashes
      : Array.isArray(node.dashPattern)
        ? node.dashPattern
        : null;
    if (dashArraySource && dashArraySource.length > 0) {
      const dashArray = dashArraySource
        .map((value: any) => this.formatNumber(value))
        .join(", ");
      strokeAttrs += ` stroke-dasharray="${dashArray}"`;
    }
    if (typeof node.strokeDashOffset === "number") {
      strokeAttrs += ` stroke-dashoffset="${this.formatNumber(node.strokeDashOffset)}"`;
    }
    if (typeof node.strokeMiterAngle === "number") {
      strokeAttrs += ` stroke-miterlimit="${this.formatNumber(node.strokeMiterAngle)}"`;
    }

    const clipRuleAttr =
      strokeRule === "evenodd" ? ` clip-rule="${strokeRule}"` : "";
    elements.push(
      `<path d="${pathData}" fill="none"${clipRuleAttr}${strokeAttrs} />`,
    );

    return { elements, defs };
  }

  convertGeneric(
    node: any,
    className: string,
    classAttr: string,
    inlineStyles: string,
    styles: any,
  ) {
    const children = node.children || [];

    const imageTag = this.generateImageTag(node, styles);

    // Determine the correct tag (button or div)
    const tag = this.isButton(node) ? "button" : "div";

    if (children.length === 0) {
      if (imageTag) {
        return `<${tag}${classAttr}${inlineStyles}>${imageTag}</${tag}>`;
      }
      return `<${tag}${classAttr}${inlineStyles}></${tag}>`;
    }

    const childrenHTML = children
      .map((child: any) =>
        this.convertNode(child, { bounds: node.absoluteBoundingBox, node }),
      )
      .filter((html: any) => html)
      .join("\n");

    if (imageTag) {
      return `<${tag}${classAttr}${inlineStyles}>
${imageTag}
${childrenHTML}
</${tag}>`;
    }

    return `<${tag}${classAttr}${inlineStyles}>
${childrenHTML}
</${tag}>`;
  }

  getNodeStyles(node: any, parentBounds: any, parentNode: any) {
    const styles: any = {};
    const bounds = node.absoluteBoundingBox;
    const parentLayoutMode = parentNode?.layoutMode ?? "NONE";
    const isParentAutoLayout = parentLayoutMode && parentLayoutMode !== "NONE";
    const parentWidth = parentBounds?.width ?? 0;
    const treatAsAbsolute = Boolean(
      this.options.useAbsolutePositioning &&
      parentBounds &&
      (!isParentAutoLayout || node.layoutPositioning === "ABSOLUTE"),
    );

    if (bounds) {
      if (!parentBounds && this.rootWidth === null) {
        this.rootWidth = bounds.width;
      }

      if (treatAsAbsolute) {
        styles.position = "absolute";

        const offsetX = bounds.x - parentBounds.x;
        const offsetY = bounds.y - parentBounds.y;
        const usePixelPosition = node.type === "TEXT";

        if (this.options.responsive && parentWidth > 0 && !usePixelPosition) {
          styles.left = `${((offsetX / parentWidth) * 100).toFixed(2)}%`;
        } else {
          styles.left = `${offsetX}px`;
        }

        styles.top = `${offsetY}px`;
        styles.zIndex = this.zIndexCounter++;
      } else if (this.options.useAbsolutePositioning && !parentBounds) {
        styles.position = "relative";
      }

      if (treatAsAbsolute) {
        styles.position = "absolute";

        const offsetX = bounds.x - parentBounds.x;
        const offsetY = bounds.y - parentBounds.y;

        if (this.options.responsive && parentWidth > 0) {
          styles.left = `${((offsetX / parentWidth) * 100).toFixed(2)}%`;
        } else {
          styles.left = `${offsetX}px`;
        }

        styles.top = `${offsetY}px`;
        styles.zIndex = this.zIndexCounter++;
      } else if (this.options.useAbsolutePositioning && !parentBounds) {
        styles.position = "relative";
      }

      if (this.options.responsive && !parentBounds) {
        styles.width = "100%";
        // styles.maxWidth = `${bounds.width}px`;
        styles.minHeight = `${bounds.height}px`;
      } else if (
        this.options.responsive &&
        parentBounds &&
        !isParentAutoLayout &&
        node.layoutMode === "NONE"
      ) {
        if (parentWidth > 0) {
          const widthPercent = (bounds.width / parentWidth) * 100;
          styles.width = `${widthPercent.toFixed(2)}%`;
        } else {
          styles.width = `${bounds.width}px`;
        }
        styles.height = `${bounds.height}px`;
      } else {
        styles.width = `${bounds.width}px`;
        styles.height = `${bounds.height}px`;
      }

      if (isParentAutoLayout && node.layoutPositioning !== "ABSOLUTE") {
        // For auto-layout parents rely on flex flow instead of absolute offsets.
        styles.position = "relative";
        delete styles.left;
        delete styles.top;

        const alignSelfMap: Record<string, string> = {
          MIN: "flex-start",
          MAX: "flex-end",
          CENTER: "center",
          STRETCH: "stretch",
        };

        if (node.layoutAlign && alignSelfMap[node.layoutAlign]) {
          styles.alignSelf = alignSelfMap[node.layoutAlign];
        }

        if (typeof node.layoutGrow === "number") {
          styles.flexGrow = node.layoutGrow;
          styles.flexShrink = node.layoutGrow > 0 ? 1 : 0;
        }

        if (parentLayoutMode === "HORIZONTAL") {
          if (node.layoutGrow && node.layoutGrow > 0) {
            styles.width = "auto";
          } else if (node.layoutAlign === "STRETCH") {
            styles.width = "100%";
          } else {
            styles.width = `${bounds.width}px`;
          }
          styles.height = `${bounds.height}px`;
        } else if (parentLayoutMode === "VERTICAL") {
          styles.width = `${bounds.width}px`;
          if (node.layoutGrow && node.layoutGrow > 0) {
            styles.height = "auto";
          } else if (node.layoutAlign === "STRETCH") {
            styles.height = "100%";
          } else {
            styles.height = `${bounds.height}px`;
          }
        }
      }
    }

    if (node.layoutMode && node.layoutMode !== "NONE") {
      styles.display = "flex";
      styles.flexDirection =
        node.layoutMode === "HORIZONTAL" ? "row" : "column";

      if (node.primaryAxisAlignItems) {
        const alignMap: any = {
          MIN: "flex-start",
          CENTER: "center",
          MAX: "flex-end",
          SPACE_BETWEEN: "space-between",
        };
        styles.justifyContent =
          alignMap[node.primaryAxisAlignItems] || "flex-start";
      }

      if (node.counterAxisAlignItems) {
        const alignMap: any = {
          MIN: "flex-start",
          CENTER: "center",
          MAX: "flex-end",
          BASELINE: "baseline",
        };
        styles.alignItems =
          alignMap[node.counterAxisAlignItems] || "flex-start";
      }

      if (node.itemSpacing) styles.gap = `${node.itemSpacing}px`;
      if (
        node.paddingLeft ||
        node.paddingRight ||
        node.paddingTop ||
        node.paddingBottom
      ) {
        styles.padding = `${node.paddingTop || 0}px ${node.paddingRight || 0}px ${node.paddingBottom || 0}px ${node.paddingLeft || 0}px`;
      }
    }

    if (
      node.type !== "TEXT" &&
      node.fills &&
      Array.isArray(node.fills) &&
      node.fills.length > 0
    ) {
      const visibleFills: any = node.fills.filter(
        (fill: any) => fill.visible !== false,
      );

      const shouldUseImgTag = this.shouldUseImgTag(node, visibleFills);

      if (visibleFills.length > 0 && !shouldUseImgTag) {
        const backgrounds: any[] = [];

        for (const fill of visibleFills) {
          if (fill.type === "SOLID") {
            backgrounds.push(this.rgbaToCSS(fill.color, fill.opacity));
          } else if (fill.type === "GRADIENT_LINEAR") {
            backgrounds.push(this.gradientToCSS(fill));
          } else if (fill.type === "GRADIENT_RADIAL") {
            backgrounds.push(this.radialGradientToCSS(fill));
          } else if (fill.type === "IMAGE") {
            backgrounds.push(this.imageToCSS(fill, bounds, node.id));
          }
        }

        if (backgrounds.length === 1) {
          if (
            backgrounds[0].startsWith("url") ||
            backgrounds[0].includes("gradient")
          ) {
            styles.background = backgrounds[0];
          } else {
            styles.backgroundColor = backgrounds[0];
          }
        } else if (backgrounds.length > 1) {
          styles.background = backgrounds.join(", ");
        }
      } else if (shouldUseImgTag) {
        const backgrounds: any = [];

        for (const fill of visibleFills) {
          if (fill.type === "SOLID") {
            backgrounds.push(this.rgbaToCSS(fill.color, fill.opacity));
          } else if (fill.type === "GRADIENT_LINEAR") {
            backgrounds.push(this.gradientToCSS(fill));
          } else if (fill.type === "GRADIENT_RADIAL") {
            backgrounds.push(this.radialGradientToCSS(fill));
          }
        }

        if (backgrounds.length === 1) {
          if (backgrounds[0].includes("gradient")) {
            styles.background = backgrounds[0];
          } else {
            styles.backgroundColor = backgrounds[0];
          }
        } else if (backgrounds.length > 1) {
          styles.background = backgrounds.join(", ");
        }
      }
    }

    if (node.backgroundColor && !styles.backgroundColor && !styles.background) {
      styles.backgroundColor = this.rgbaToCSS(node.backgroundColor, 1);
    }

    if (node.strokes && node.strokes.length > 0) {
      const visibleStrokes = node.strokes.filter(
        (stroke: any) => stroke.visible !== false,
      );

      if (visibleStrokes.length > 0) {
        const stroke = visibleStrokes[0];
        if (stroke.type === "SOLID") {
          const borderWidth = node.strokeWeight || 1;
          const borderColor = this.rgbaToCSS(stroke.color, stroke.opacity);

          const strokeAlign = node.strokeAlign || "INSIDE";
          if (strokeAlign === "OUTSIDE") {
            styles.outline = `${borderWidth}px solid ${borderColor}`;
            styles.outlineOffset = "0px";
          } else {
            styles.border = `${borderWidth}px solid ${borderColor}`;
          }
        }
      }
    }

    if (node.cornerRadius !== undefined) {
      styles.borderRadius = `${node.cornerRadius}px`;
    } else if (node.rectangleCornerRadii) {
      const [tl, tr, br, bl] = node.rectangleCornerRadii;
      styles.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
    }

    if (node.opacity !== undefined && node.opacity !== 1) {
      styles.opacity = node.opacity;
    }

    if (node.rotation !== undefined && node.rotation !== 0) {
      styles.transform = `rotate(${node.rotation}deg)`;
      styles.transformOrigin = "center center";
    }

    if (
      node.blendMode &&
      node.blendMode !== "PASS_THROUGH" &&
      node.blendMode !== "NORMAL"
    ) {
      styles.mixBlendMode = this.blendModeToCSS(node.blendMode);
    }

    if (node.effects && node.effects.length > 0) {
      const shadows = [];
      let blurValue = null;
      let backdropBlurValue = null;

      for (const effect of node.effects) {
        if (effect.visible !== false) {
          if (effect.type === "DROP_SHADOW") {
            shadows.push(this.dropShadowToCSS(effect));
          } else if (effect.type === "INNER_SHADOW") {
            shadows.push(this.innerShadowToCSS(effect));
          } else if (effect.type === "LAYER_BLUR") {
            blurValue = effect.radius;
          } else if (effect.type === "BACKGROUND_BLUR") {
            backdropBlurValue = effect.radius;
          }
        }
      }

      if (shadows.length > 0) {
        styles.boxShadow = shadows.join(", ");
      }

      const filters = [];
      if (blurValue !== null) {
        filters.push(`blur(${blurValue}px)`);
      }
      if (filters.length > 0) {
        styles.filter = filters.join(" ");
      }

      if (backdropBlurValue !== null) {
        styles.backdropFilter = `blur(${backdropBlurValue}px)`;
        styles.WebkitBackdropFilter = `blur(${backdropBlurValue}px)`;
      }
    }

    if (node.type === "TEXT" && node.style) {
      Object.assign(styles, this.getTextStyles(node.style));

      if (node.fills && node.fills.length > 0) {
        const visibleFills = node.fills.filter((f: any) => f.visible !== false);
        if (visibleFills.length > 0 && visibleFills[0].type === "SOLID") {
          styles.color = this.rgbaToCSS(
            visibleFills[0].color,
            visibleFills[0].opacity,
          );
        }
      }
    }

    // if (node.clipsContent) {
    //   // styles.overflow = 'hidden';
    // }

    return styles;
  }

  getTextStyles(style: any) {
    const textStyles: any = {
      margin: "0",
    };

    if (style.fontFamily) {
      textStyles.fontFamily = `'${style.fontFamily}', sans-serif`;
    }
    if (style.fontSize) {
      if (this.options.responsive) {
        const minSize = Math.max(style.fontSize * 0.7, 12);
        const maxSize = style.fontSize;
        const preferredSize = `${(style.fontSize / 16) * 100}%`;
        textStyles.fontSize = `clamp(${minSize}px, ${preferredSize}, ${maxSize}px)`;
      } else {
        textStyles.fontSize = `${style.fontSize}px`;
      }
    }
    if (style.fontWeight) {
      textStyles.fontWeight = style.fontWeight;
    }
    if (style.letterSpacing) {
      textStyles.letterSpacing = `${style.letterSpacing}px`;
    }
    if (style.lineHeightPx && style.lineHeightPx > 0) {
      textStyles.lineHeight = `${style.lineHeightPx}px`;
    } else if (style.lineHeightPercent && style.lineHeightPercent > 0) {
      textStyles.lineHeight = `${style.lineHeightPercent}%`;
    }
    if (style.textAlignHorizontal) {
      textStyles.textAlign = style.textAlignHorizontal.toLowerCase();
    }
    if (style.textDecoration) {
      textStyles.textDecoration = style.textDecoration
        .toLowerCase()
        .replace("_", "-");
    }
    if (style.textCase) {
      if (style.textCase === "UPPER") textStyles.textTransform = "uppercase";
      else if (style.textCase === "LOWER")
        textStyles.textTransform = "lowercase";
      else if (style.textCase === "TITLE")
        textStyles.textTransform = "capitalize";
    }
    if (style.italic) {
      textStyles.fontStyle = "italic";
    }

    return textStyles;
  }

  rgbaToCSS(color: any, opacity = 1) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = (color.a ?? 1) * (opacity ?? 1);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  gradientToCSS(gradient: any) {
    if (!gradient.gradientStops || gradient.gradientStops.length < 2) {
      return "transparent";
    }

    let angle = 90;
    if (
      gradient.gradientHandlePositions &&
      gradient.gradientHandlePositions.length >= 2
    ) {
      const start = gradient.gradientHandlePositions[0];
      const end = gradient.gradientHandlePositions[1];
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    }

    const stops = gradient.gradientStops
      .map((stop: any) => {
        const color = this.rgbaToCSS(stop.color);
        const position = Math.round(stop.position * 100);
        return `${color} ${position}%`;
      })
      .join(", ");

    return `linear-gradient(${angle}deg, ${stops})`;
  }

  radialGradientToCSS(gradient: any) {
    if (!gradient.gradientStops || gradient.gradientStops.length < 2) {
      return "transparent";
    }

    const stops = gradient.gradientStops
      .map((stop: any) => {
        const color = this.rgbaToCSS(stop.color);
        const position = Math.round(stop.position * 100);
        return `${color} ${position}%`;
      })
      .join(", ");

    return `radial-gradient(circle, ${stops})`;
  }

  imageToCSS(imageFill: any, bounds: any, nodeId: string) {
    if (!imageFill.imageRef) {
      return "transparent";
    }

    this.imageRefs.add(imageFill.imageRef);
    if (nodeId) {
      this.imageNodes.set(nodeId, imageFill.imageRef);
    }

    const imageUrl =
      this?.options?.imageUrls?.[imageFill.imageRef] ||
      `https://via.placeholder.com/${Math.round(bounds?.width || 100)}x${Math.round(bounds?.height || 100)}?text=Image`;

    const scaleMode = imageFill.scaleMode || "FILL";

    let cssValue = `url('${imageUrl}')`;

    if (scaleMode === "FILL") {
      cssValue += " center/cover no-repeat";
    } else if (scaleMode === "FIT") {
      cssValue += " center/contain no-repeat";
    } else if (scaleMode === "TILE") {
      cssValue += " repeat";
    } else if (scaleMode === "STRETCH") {
      cssValue += " center/100% 100% no-repeat";
    }

    return cssValue;
  }

  shouldUseImgTag(node: any, visibleFills: any) {
    return visibleFills.some(
      (fill: any) => fill.type === "IMAGE" && fill.imageRef,
    );
  }

  generateImageTag(node: any, styles: any) {
    if (node.type === "TEXT") return null;
    if (!node.fills || !Array.isArray(node.fills)) return null;

    const visibleFills = node.fills.filter(
      (fill: any) => fill.visible !== false,
    );
    if (!this.shouldUseImgTag(node, visibleFills)) return null;

    // Find the image fill
    const imageFill = visibleFills.find(
      (fill: any) => fill.type === "IMAGE" && fill.imageRef,
    );
    if (!imageFill) return null;

    const bounds = node.absoluteBoundingBox;

    this.imageRefs.add(imageFill.imageRef);
    if (node.id) {
      this.imageNodes.set(node.id, imageFill.imageRef);
    }

    const imageUrl =
      this?.options?.imageUrls?.[imageFill.imageRef] ||
      `https://via.placeholder.com/${Math.round(bounds?.width || 100)}x${Math.round(bounds?.height || 100)}?text=Image`;

    const scaleMode = imageFill.scaleMode || "FILL";
    let objectFit = "cover";
    let objectPosition = "center";

    if (scaleMode === "FIT") {
      objectFit = "contain";
    } else if (scaleMode === "TILE") {
      objectFit = "none";
    } else if (scaleMode === "STRETCH") {
      objectFit = "fill";
    } else if (scaleMode === "CROP") {
      objectFit = "cover";
    }

    const altText = this.escapeHtml(node.name || "Image");

    const imgStyles: any = {
      width: "100%",
      height: "100%",
      objectFit: objectFit,
      objectPosition: objectPosition,
      display: "block",
    };

    if (styles.borderRadius) {
      imgStyles.borderRadius = styles.borderRadius;
    }

    const imgStyleString = Object.entries(imgStyles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join("; ");

    return `<img src="${imageUrl}" alt="${altText}" style="${imgStyleString}" loading="lazy" />`;
  }

  dropShadowToCSS(effect: any) {
    const x = effect.offset?.x || 0;
    const y = effect.offset?.y || 0;
    const blur = effect.radius || 0;
    const spread = effect.spread || 0;
    const color = this.rgbaToCSS(effect.color);

    if (spread !== 0) {
      return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
    }
    return `${x}px ${y}px ${blur}px ${color}`;
  }

  innerShadowToCSS(effect: any) {
    const x = effect.offset?.x || 0;
    const y = effect.offset?.y || 0;
    const blur = effect.radius || 0;
    const spread = effect.spread || 0;
    const color = this.rgbaToCSS(effect.color);

    if (spread !== 0) {
      return `inset ${x}px ${y}px ${blur}px ${spread}px ${color}`;
    }
    return `inset ${x}px ${y}px ${blur}px ${color}`;
  }

  blendModeToCSS(blendMode: any) {
    const mapping = {
      MULTIPLY: "multiply",
      SCREEN: "screen",
      OVERLAY: "overlay",
      DARKEN: "darken",
      LIGHTEN: "lighten",
      COLOR_DODGE: "color-dodge",
      COLOR_BURN: "color-burn",
      HARD_LIGHT: "hard-light",
      SOFT_LIGHT: "soft-light",
      DIFFERENCE: "difference",
      EXCLUSION: "exclusion",
      HUE: "hue",
      SATURATION: "saturation",
      COLOR: "color",
      LUMINOSITY: "luminosity",
    } as any;
    return mapping[blendMode] || "normal";
  }

  generateClassName(node: any) {
    const safeName = node.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${this.options.classPrefix}${safeName}-${node.id.replace(/[^a-z0-9]/gi, "")}`;
  }

  getTextTag(node: any) {
    if (!node.style) return "p";

    const fontSize = node.style.fontSize || 16;
    if (fontSize >= 32) return "h1";
    if (fontSize >= 24) return "h2";
    if (fontSize >= 18) return "span";
    return "p";
  }

  isButton(node: any): boolean {
    if (!node || !node.name) return false;

    const nodeName = node.name.toLowerCase();

    const buttonPatterns = [/^btn/i, /button/i];

    if (buttonPatterns.some((pattern) => pattern.test(nodeName))) {
      return true;
    }

    if (
      /primary|secondary|tertiary|danger|warning|success/.test(nodeName) &&
      /button|btn|action|cta/.test(nodeName)
    ) {
      return true;
    }

    return false;
  }

  generateCSS() {
    let css = "";
    for (const [className, styles] of this.styles) {
      css += `.${className} {\n`;
      for (const [prop, value] of Object.entries(styles)) {
        const cssProp = this.camelToKebab(prop);
        css += `  ${cssProp}: ${value};\n`;
      }
      css += "}\n\n";
    }
    return css;
  }

  generateFontImports() {
    if (!this.options.includeFonts || this.fontFamilies.size === 0) {
      return "";
    }

    const fonts = Array.from(this.fontFamilies)
      .map((font) => font.replace(/\s+/g, "+"))
      .join("|");

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${fonts}:wght@400;500;600;700&display=swap" rel="stylesheet">`;
  }

  stylesToString(styles: any) {
    return Object.entries(styles)
      .map(([prop, value]) => `${this.camelToKebab(prop)}: ${value}`)
      .join("; ");
  }

  camelToKebab(str: string) {
    return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  escapeHtml(text: string) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    } as any;
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Replace generated CSS class names with their Tailwind equivalents in HTML
   * Maps original class names to Tailwind class arrays
   */
  private replaceCSSClassesWithTailwind(
    html: string,
    classMapping: Map<string, string[]>,
  ): string {
    let result = html;

    for (const [generatedClass, tailwindClasses] of classMapping) {
      if (tailwindClasses.length === 0) continue;

      const tailwindClassString = tailwindClasses.join(" ");

      // Replace the generated class with Tailwind classes
      // Handles class="generatedClass" or class="generatedClass otherClasses"
      const escapedClass = generatedClass.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      // Pattern 1: class="generatedClass" (entire class attribute)
      const singleClassRegex = new RegExp(`class="${escapedClass}"`, "g");
      result = result.replace(
        singleClassRegex,
        `class="${tailwindClassString}"`,
      );

      // Pattern 2: class="generatedClass otherClasses" (at start)
      const startRegex = new RegExp(`class="${escapedClass}\\s+`, "g");
      result = result.replace(startRegex, `class="${tailwindClassString} `);

      // Pattern 3: class="otherClasses generatedClass" (at end)
      const endRegex = new RegExp(`\\s+${escapedClass}"`, "g");
      result = result.replace(endRegex, ` ${tailwindClassString}"`);

      // Pattern 4: class="otherClasses generatedClass otherClasses" (in middle)
      const middleRegex = new RegExp(`\\s+${escapedClass}\\s+`, "g");
      result = result.replace(middleRegex, ` ${tailwindClassString} `);
    }

    return result;
  }
}
