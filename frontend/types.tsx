export interface ServerEntry {
    name?: string;
    m_szServerName?: string;
    strName?: string;
    players?: number | string;
    nPlayers?: number | string;
    numPlayers?: number | string;
    maxPlayers?: number | string;
    nMaxPlayers?: number | string;
    ip?: string;
    addr?: string;
    port?: number | string;
    queryPort?: number | string;
    [key: string]: unknown;
}

export type PruneReason = 'Emoji' | 'Cyrillic' | 'CustomString' | 'PlayerSpoof' | 'IPAddress' | 'Subnet';

export interface PruneResult {
    reason: PruneReason | null;
    label?: string;
    ipInfo?: string;
}

export interface BrowserStats {
    count_servers_total: number;
    count_servers_verified: number;
    count_servers_legit: number;
    count_servers_spam: number;
    count_players_total: number;
    count_players_verified: number;
    count_players_legit: number;
    count_players_spam: number;
}

export type OnServerCb = (srv: ServerEntry) => void;
export type OnCompleteCb = (result: unknown) => void;

export interface ServerBrowserAPI {
    CreateServerListRequest: (
        appid: number,
        serverTab: string,
        prefs: unknown,
        onServer: OnServerCb,
        onComplete: OnCompleteCb
    ) => unknown;
}

export interface IPStats {
    total: number;
}

export interface SuspiciousIP {
    ip: string;
    total: number;
    type: 'single' | 'subnet';
}