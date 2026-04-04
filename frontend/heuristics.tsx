import {
    ServerEntry,
    PruneReason,
    PruneResult,
    IPStats,
    SuspiciousIP,
} from './types';
import {
    getIPAddressThreshold,
    getIPSubnetThreshold,
    getBlockedRegex,
    isFilterEnabled,
    VERIFIED_STRING,
    VERIFIED_NAME_RE
} from './constants';



export { VERIFIED_NAME_RE, ServerEntry };
export type { PruneReason, PruneResult };

export interface FilterStats {
    count_cyrillic: number;
    count_emoji: number;
    count_custom_string: number;
    count_player_spoof: number;
    count_ip_address: number;
    count_subnet: number;
}

export class IPConcentrationTracker {
    private ipMap: Map<string, IPStats> = new Map();
    private subnetMap: Map<string, IPStats> = new Map();

    recordServer(ip: string): void {
        if (!this.ipMap.has(ip)) {
            this.ipMap.set(ip, { total: 0 });
        }
        this.ipMap.get(ip)!.total++;

        const subnet = extractSubnet(ip);
        if (!this.subnetMap.has(subnet)) {
            this.subnetMap.set(subnet, { total: 0 });
        }
        this.subnetMap.get(subnet)!.total++;
    }

    getSuspiciousIPs(): SuspiciousIP[] {
        const suspicious: SuspiciousIP[] = [];
        const ipThreshold = getIPAddressThreshold();
        const subnetThreshold = getIPSubnetThreshold();

        for (const [ip, stats] of this.ipMap.entries()) {
            if (stats.total >= ipThreshold) {
                suspicious.push({ ip, total: stats.total, type: 'single' });
            }
        }

        for (const [subnet, stats] of this.subnetMap.entries()) {
            if (stats.total >= subnetThreshold) {
                suspicious.push({ ip: subnet, total: stats.total, type: 'subnet' });
            }
        }

        return suspicious.sort((a, b) => b.total - a.total);
    }

    reset(): void {
        this.ipMap.clear();
        this.subnetMap.clear();
    }

    getIpStats(ip: string): IPStats | undefined {
        return this.ipMap.get(ip);
    }

    getSubnetStats(ip: string): IPStats | undefined {
        const subnet = extractSubnet(ip);
        return this.subnetMap.get(subnet);
    }
}

export const isCyrillic = (s: string): boolean => /[\p{Script=Cyrillic}]/u.test(s);
export const hasEmoji = (s: string): boolean => /\p{Extended_Pictographic}/u.test(s);
export const extractSubnet = (ip: string): string => {
    const parts = ip.split('.');
    return parts.slice(0, 3).join('.');
};

function shouldPrune(
    server: ServerEntry,
    ip: string,
    port: string,
    tracker: IPConcentrationTracker
): PruneResult {
    const name = String(server.name ?? server.m_szServerName ?? server.strName ?? '');
    const players = Number(server.players ?? server.nPlayers ?? server.numPlayers ?? 0);
    const maxPlayers = Number(server.maxPlayers ?? server.nMaxPlayers ?? 0);
    const addr = `${ip}:${port}`;

    if (isFilterEnabled('filter_emoji') && hasEmoji(name)) {
        console.log(`[Emojis] ${addr}: ${name}`);
        return { reason: 'Emoji' };
    }

    if (isFilterEnabled('filter_cyrillic') && isCyrillic(name)) {
        console.log(`[Cyrillic] ${addr}: ${name}`);
        return { reason: 'Cyrillic' };
    }

    if (isFilterEnabled('filter_custom_string') && !VERIFIED_STRING.test(name) && getBlockedRegex().some(re => re.test(name))) {
        console.log(`[CustomString] ${addr}: ${name}`);
        return { reason: 'CustomString' };
    }

    if (isFilterEnabled('filter_player_spoof') && (players > 64 || maxPlayers > 64)) {
        console.log(`[PlayerSpoof] ${addr}: ${name} (${players}/${maxPlayers})`);
        return { reason: 'PlayerSpoof' };
    }

    const ipStats = tracker.getIpStats(ip);
    if (isFilterEnabled('filter_ip_concentration') && ipStats && ipStats.total >= getIPAddressThreshold()) {
        console.log(`[IPAddress] ${addr}: ${name} (${ip}: ${ipStats.total} servers)`);
        return { reason: 'IPAddress', ipInfo: `${ip} (${ipStats.total})` };
    }

    const subnetStats = tracker.getSubnetStats(ip);
    if (isFilterEnabled('filter_subnet_concentration') && subnetStats && subnetStats.total >= getIPSubnetThreshold()) {
        const subnet = extractSubnet(ip);
        console.log(`[Subnet] ${addr}: ${name} (${subnet}.0/24: ${subnetStats.total} servers)`);
        return { reason: 'Subnet', ipInfo: `${subnet}.0/24 (${subnetStats.total})` };
    }

    /*
        GEOLOCATION SOON
    */

    if (VERIFIED_STRING.test(name)) { return { reason: null, label: 'verified' } };

    return { reason: null };
}

export function filterServer(
    server: ServerEntry,
    ip: string,
    tracker: IPConcentrationTracker,
    stats: FilterStats
): boolean {
    tracker.recordServer(ip);
    const result = shouldPrune(server, ip, String(server?.port ?? '?'), tracker);

    if (result.reason !== null) {
        switch (result.reason) {
            case 'Emoji':
                stats.count_emoji++;
                break;
            case 'Cyrillic':
                stats.count_cyrillic++;
                break;
            case 'CustomString':
                stats.count_custom_string++;
                break;
            case 'PlayerSpoof':
                stats.count_player_spoof++;
                break;
            case 'IPAddress':
                stats.count_ip_address++;
                break;
            case 'Subnet':
                stats.count_subnet++;
                break;
        }
        return false;
    }

    return true;
}