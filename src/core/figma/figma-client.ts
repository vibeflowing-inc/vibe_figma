
import type {
    FigmaFileNodesResponse,
    FigmaFileResponse,
    ImportOptions
} from "./types"


function extractFileKey(url: string): string | null {
    const match = url.match(/figma\.com\/(design|file)\/([a-zA-Z0-9]+)/);
    return match ? (match[2] || null) : null;
}

function extractNodeId(url: string): string | null {
    const nodeIdMatch = url.match(/node-id=([^&]+)/);
    return nodeIdMatch && nodeIdMatch[1] ? nodeIdMatch[1].replace(/-/g, ':') : null;
}

function buildQueryString(options: ImportOptions): string {
    const params = new URLSearchParams();

    if (options.version) params.append('version', options.version);
    if (options.ids && options.ids.length > 0) params.append('ids', options.ids.join(','));
    if (options.depth) params.append('depth', options.depth.toString());
    if (options.geometry) params.append('geometry', options.geometry);
    if (options.plugin_data) params.append('plugin_data', options.plugin_data);
    if (options.branch_data) params.append('branch_data', 'true');

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
}

export const importFigma = async ({
    url,
    options = {},
    accessToken,
    authType = 'x-figma-token'
}: {
    accessToken: string
    url: string,
    options: ImportOptions
    authType?: 'x-figma-token' | 'authorization'
}) => {
    try {
        const fileKey = extractFileKey(url);
        if (!fileKey) {
            throw new Error('Invalid Figma URL: Could not extract file key');
        }

        const nodeId = extractNodeId(url);

        if (!options.geometry) {
            options.geometry = 'paths';
        }


        if (nodeId && !options.ids?.includes(nodeId)) {
            options.ids = [...(options.ids || []), nodeId];
        }

        const useNodesEndpoint = options.useNodesEndpoint || (options.ids && options.ids.length > 0);

        let apiUrl: string;
        if (useNodesEndpoint && options.ids && options.ids.length > 0) {
            apiUrl = `https://api.figma.com/v1/files/${fileKey}/nodes${buildQueryString(options)}`;
        } else {
            apiUrl = `https://api.figma.com/v1/files/${fileKey}${buildQueryString(options)}`;
        }

        console.log(`Fetching from: ${apiUrl}`);

        const headers: Record<string, string> = {};
        if (authType === 'authorization') {
            headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
            headers['X-Figma-Token'] = accessToken;
        }

        const response = await fetch(apiUrl, {
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Figma API Error:', errorText);

            if (response.status === 403) {
                throw new Error(`Invalid or expired token.`);
            }
            throw new Error(`Failed to fetch Figma file data: ${response.status} ${response.statusText}`);
        }

        if (useNodesEndpoint && options.ids && options.ids.length > 0) {
            const fileData = await response.json() as FigmaFileNodesResponse;

            await Bun.write(`figma_file_nodes_${fileKey}.json`, JSON.stringify(fileData, null, 2));

            return {
                fileKey,
                nodeId,
                fileName: fileData.name,
                lastModified: fileData.lastModified,
                thumbnailUrl: fileData.thumbnailUrl,
                version: undefined,
                role: fileData.role,
                editorType: fileData.editorType,
                nodes: fileData.nodes,
                error: fileData.err,
                endpoint: 'nodes'
            };
        } else {
            const fileData = await response.json() as FigmaFileResponse;

            return {
                fileKey,
                nodeId,
                fileName: fileData.name,
                lastModified: fileData.lastModified,
                thumbnailUrl: fileData.thumbnailUrl,
                version: fileData.version,
                role: fileData.role,
                editorType: fileData.editorType,
                document: fileData.document,
                components: fileData.components,
                componentSets: fileData.componentSets,
                styles: fileData.styles,
                schemaVersion: fileData.schemaVersion,
                mainFileKey: fileData.mainFileKey,
                branches: fileData.branches,
                endpoint: 'file'
            };
        }

    } catch (error) {
        console.error('Error importing Figma file:', error);
        return null;
    }
}



export async function fetchFigmaImages(fileKey: string, imageNodes: Map<string, string>, accessToken: string, authType: 'x-figma-token' | 'authorization' = 'x-figma-token') {
    if (!imageNodes || imageNodes.size === 0) {
        return {};
    }

    const nodeIds = Array.from(imageNodes.keys()).join(',');
    const url = `https://api.figma.com/v1/images/${fileKey}?ids=${nodeIds}&format=png`;

    try {
        const headers: Record<string, string> = {};
        if (authType === 'authorization') {
            headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
            headers['X-Figma-Token'] = accessToken;
        }

        const response = await fetch(url, {
            headers
        });

        if (!response.ok) {
            console.error('Failed to fetch images:', response.statusText);
            return {};
        }

        const data = await response.json() as any;

        const imageMap: any = {};
        const imageDownloadMap: any = {}
        if (data.images) {
            for (const [nodeId, imageUrl] of Object.entries(data.images)) {
                const imageRef = imageNodes.get(nodeId);
                if (imageRef) {
                    let imageName = `image_${new Date().getTime()}.png`;
                    imageMap[imageRef] =  imageUrl;
                    imageDownloadMap[imageRef] = imageUrl;
                }
            }
        }

        return {
            imageMap,
            imageDownloadMap
        }
    } catch (error) {
        console.error('Error fetching images:', error);
        return {};
    }
}
