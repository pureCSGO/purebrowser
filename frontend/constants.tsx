export const VERIFIED_STRING = /purecsgo/i;
export const VERIFIED_NAME_RE = VERIFIED_STRING;

const getPluginConfig = (): Record<string, any> => {
    try {
        const stored = localStorage.getItem('plugin_purebrowser_config');
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const getIPAddressThreshold = (): number => {
    return getPluginConfig().ip_address_threshold ?? 30;
};

export const getIPSubnetThreshold = (): number => {
    return getPluginConfig().ip_subnet_threshold ?? 50;
};

export const isFilterEnabled = (key: string): boolean => {
    const val = getPluginConfig()[key];
    return val === undefined ? true : Boolean(val);
};

export const getBlockedRegex = (): RegExp[] => {
    try {
        const config = getPluginConfig();
        const patterns: string[] = Array.isArray(config.blocked_patterns)
            ? config.blocked_patterns
            : [];
        return patterns.map((p) => {
            const literalMatch = p.match(/^\/(.+)\/([gimsuy]*)$/);
            if (literalMatch) {
                return new RegExp(literalMatch[1], literalMatch[2] || 'i');
            }
            return new RegExp(p, 'i');
        });
    } catch {
        return [];
    }
};
