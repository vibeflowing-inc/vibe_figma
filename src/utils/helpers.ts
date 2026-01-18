export const replaceBase64DataUrlsWithPrefix = (assets: Record<string, string>): Record<string, string> => {
    return Object.fromEntries(
        Object.entries(assets).map(([key, value]) => [key, value.replace(/^data:image\/\w+;base64,/, 'base64:')])
    );
}
