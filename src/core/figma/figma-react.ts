import { importFigma, fetchFigmaImages } from './figma-client.js';
import { FigmaToHTML } from './figma-to-html.js';
import { transformJsx } from './transform-jsx.js';
import { cleanupGeneratedCodeToReadable } from '../cleaner/index.js';
import type {
    FigmaToReactOptions,
    FigmaToReactResult,
    ImportOptions
} from './types.js';

export class FigmaToReact {
    private accessToken: string;
    private authType: 'x-figma-token' | 'authorization';
    private options: FigmaToReactOptions;

    constructor(
        accessToken: string,
        authType: 'x-figma-token' | 'authorization' = 'x-figma-token',
        options: FigmaToReactOptions = {}
    ) {
        this.accessToken = accessToken;
        this.authType = authType;
        this.options = options;
    }

    async convertFromUrl(figmaUrl: string): Promise<FigmaToReactResult | null> {
        try {
            const importOptions: ImportOptions = {
                geometry: 'paths',
                ...this.options
            };

            console.log('Importing Figma file...');
            const figmaData = await importFigma({
                url: figmaUrl,
                options: importOptions,
                accessToken: this.accessToken,
                authType: this.authType
            });

            if (!figmaData) {
                throw new Error('Failed to import Figma file');
            }

            const documentNode = figmaData.endpoint === 'nodes'
                ? Object.values(figmaData.nodes || {})[0]?.document
                : figmaData.document;

            if (!documentNode) {
                throw new Error('No document found in Figma data');
            }

            console.log('Pre-processing to extract image nodes...');

            // First pass: create converter to extract image references
            const preConverter = new FigmaToHTML(this.options);
            preConverter.convertNode(documentNode);

            let imageUrlToFilename: Map<string, string> = new Map();
            let assets: Record<string, string> = {};

            // Use the imageNodes Map from the converter
            let imageRefToFilename: Map<string, string> = new Map();

            if (preConverter.imageNodes.size > 0) {
                console.log(`Found ${preConverter.imageNodes.size} images, downloading...`);
                const imageData = await fetchFigmaImages(
                    figmaData.fileKey,
                    preConverter.imageNodes,
                    this.accessToken,
                    this.authType
                );

                if (imageData && imageData.imageMap) {
                    const downloadResult = await this.downloadAndConvertImages(imageData.imageMap);
                    imageUrlToFilename = downloadResult.urlToFilename;
                    imageRefToFilename = downloadResult.imageRefToFilename;
                    assets = downloadResult.assets;
                    console.log(`Downloaded and converted ${Object.keys(assets).length} images`);
                }
            } else {
                console.log('No images found in the design');
            }

            console.log('Converting to JSX...');

            // Create imageUrls mapping using imageRef as keys (for FigmaToHTML)
            const imageUrls: Record<string, string> = {};
            for (const [imageRef, filename] of imageRefToFilename.entries()) {
                imageUrls[imageRef] = `/${filename}`;
            }

            const converterOptions = {
                ...this.options,
                imageUrls
            };

            const converter = new FigmaToHTML(converterOptions);
            const jsxResult = await converter.convertJSX(documentNode);

            let jsx = jsxResult.jsx as string;
            jsx = this.replaceImageUrls(jsx, imageUrlToFilename);

            if (this.options.optimizeComponents) {
                console.log('Optimizing components...');
                try {
                    const optimized = transformJsx(jsx);
                    jsx = optimized.code;
                } catch (error) {
                    console.warn('Component optimization failed, using unoptimized JSX:', error);
                }
            }

            if (this.options.useCodeCleaner) {
                console.log('Cleaning up generated code...');
                try {
                    jsx = await cleanupGeneratedCodeToReadable(jsx);
                } catch (error) {
                    console.warn('Code cleanup failed, using uncleaned JSX:', error);
                }
            }

            return {
                jsx,
                assets,
                componentName: jsxResult.componentName,
                fonts: jsxResult.fonts,
                css: jsxResult.css
            };

        } catch (error) {
            console.error('Error converting Figma to React:', error);
            return null;
        }
    }


    private async downloadImage(url: string): Promise<Buffer> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('Error downloading image:', url, error);
            throw error;
        }
    }

    private imageToBase64(buffer: Buffer, mimeType: string = 'image/png'): string {
        const base64 = buffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    }

    private getMimeTypeFromUrl(url: string): string {
        const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[extension || 'png'] || 'image/png';
    }

    private async downloadAndConvertImages(imageMap: Record<string, string>): Promise<{
        urlToFilename: Map<string, string>,
        imageRefToFilename: Map<string, string>,
        assets: Record<string, string>
    }> {
        const urlToFilename = new Map<string, string>();
        const imageRefToFilename = new Map<string, string>();
        const assets: Record<string, string> = {};
        const entries = Object.entries(imageMap);

        const downloadPromises = entries.map(async ([imageRef, url], index) => {
            try {
                // Extract extension from URL, default to 'png' if not found or invalid
                let extension = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';

                // Validate extension - must be a valid image extension
                const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
                if (!validExtensions.includes(extension)) {
                    extension = 'png'; // Default to png for Figma images
                }

                const filename = `image-${String(index + 1).padStart(3, '0')}.${extension}`;

                const buffer = await this.downloadImage(url);
                const mimeType = this.getMimeTypeFromUrl(url);
                const base64 = this.imageToBase64(buffer, mimeType);

                urlToFilename.set(url, filename);
                imageRefToFilename.set(imageRef, filename);
                assets[filename] = base64;

                return { url, filename, success: true };
            } catch (error) {
                console.error(`Failed to download image ${imageRef}:`, error);
                return { url, filename: '', success: false };
            }
        });

        await Promise.all(downloadPromises);

        return { urlToFilename, imageRefToFilename, assets };
    }

    private replaceImageUrls(jsx: string, imageUrlToFilename: Map<string, string>): string {
        let result = jsx;

        for (const [url, filename] of imageUrlToFilename.entries()) {
            const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            result = result.replace(new RegExp(escapedUrl, 'g'), `/${filename}`);

            result = result.replace(
                new RegExp(`url\\(["']?${escapedUrl}["']?\\)`, 'g'),
                `url("/${filename}")`
            );

            result = result.replace(
                new RegExp(`src=["']${escapedUrl}["']`, 'g'),
                `src="/${filename}"`
            );

            result = result.replace(
                new RegExp(`href=["']${escapedUrl}["']`, 'g'),
                `href="/${filename}"`
            );
        }

        return result;
    }
}

export async function convertFigmaToReact(
    figmaUrl: string,
    accessToken: string,
    authType: 'x-figma-token' | 'authorization' = 'x-figma-token',
    options: FigmaToReactOptions = {}
): Promise<FigmaToReactResult | null> {
    const converter = new FigmaToReact(accessToken, authType, options);
    return converter.convertFromUrl(figmaUrl);
}
