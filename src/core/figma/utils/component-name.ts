export const generateComponentName = (name: string) : string => {
    let cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
    cleaned = cleaned.replace(/^[^a-zA-Z]+/, '');
    if (cleaned.length === 0) {
        cleaned = 'Default';
    }
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return cleaned.endsWith('Component') ? cleaned : cleaned + 'Component';
}
