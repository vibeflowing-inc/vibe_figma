import type { Config } from 'tailwindcss';

export interface FigmaToHTMLOptions {
  useAbsolutePositioning?: boolean;
  generateClasses?: boolean;
  classPrefix?: string;
  includeFonts?: boolean;
  imageUrls?: Record<string, string>;
  responsive?: boolean;
  useTailwind?: boolean;
  tailwindConfig?: Config;
  keepFallbackStyles?: boolean;
  [key: string]: any;
}

export interface FigmaTokens {
    accessToken: string;
}
export interface FigmaComponent {
    key: string;
    name: string;
    description: string;
    componentSetId?: string;
    documentationLinks: any[];
}

export interface FigmaStyle {
    key: string;
    name: string;
    description: string;
    styleType: string;
}

export interface FigmaNode {
    id: string;
    name: string;
    type: string;
    [key: string]: any;
}

export interface FigmaFileResponse {
    name: string;
    role: string;
    lastModified: string;
    editorType: string;
    thumbnailUrl: string;
    version: string;
    document: FigmaNode;
    components: Record<string, FigmaComponent>;
    componentSets: Record<string, any>;
    schemaVersion: number;
    styles: Record<string, FigmaStyle>;
    mainFileKey?: string;
    branches?: Array<{
        key: string;
        name: string;
        thumbnail_url: string;
        last_modified: string;
        link_access: string;
    }>;
}

export interface FigmaFileNodesResponse {
    name: string;
    role: string;
    lastModified: string;
    editorType: string;
    thumbnailUrl: string;
    err?: string;
    nodes: Record<string, {
        document: FigmaNode;
        components: Record<string, FigmaComponent>;
        componentSets: Record<string, any>;
        schemaVersion: number;
        styles: Record<string, FigmaStyle>;
    } | null>;
}

export interface ImportOptions {
    version?: string;
    ids?: string[];
    depth?: number;
    geometry?: 'paths';
    plugin_data?: string;
    branch_data?: boolean;
    useNodesEndpoint?: boolean;
}

export interface FigmaToReactOptions extends FigmaToHTMLOptions {
    authType?: 'x-figma-token' | 'authorization';
    optimizeComponents?: boolean;
    useCodeCleaner?: boolean;
}

export interface FigmaToReactResult {
    jsx: string;
    assets: Record<string, string>;
    componentName: string;
    fonts: string;
    css: string;
}