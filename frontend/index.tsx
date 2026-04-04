// pureBrowser v1.0.0 by mortsource
// Come play on pureCSGO.com
// Donate to plugin with trade link on website

import React from 'react';
import { definePlugin, Millennium, IconsModule } from '@steambrew/client';
import { SettingsPanel, injectCounter, injectRowHighlighter, injectVerifiedToggle, injectVerifiedBar, scheduleUpdateCounter, updateCounter } from './userinterface';
import { filterServer, IPConcentrationTracker, FilterStats } from './heuristics';
import {
    BrowserStats,
    OnServerCb,
    OnCompleteCb,
    ServerBrowserAPI,
    ServerEntry,
} from './types';
import { VERIFIED_NAME_RE } from './constants';

let tracker: IPConcentrationTracker = new IPConcentrationTracker();

let stats: BrowserStats = {
    count_servers_total: 0,
    count_servers_verified: 0,
    count_servers_legit: 0,
    count_servers_spam: 0,
    count_players_total: 0,
    count_players_verified: 0,
    count_players_legit: 0,
    count_players_spam: 0,
};

let filterStats: FilterStats = {
    count_cyrillic: 0,
    count_emoji: 0,
    count_custom_string: 0,
    count_player_spoof: 0,
    count_ip_address: 0,
    count_subnet: 0,
};

/*
    HELPER FUNCTIONS
*/
function resetCounters() {
    stats = {
        count_servers_total: 0,
        count_servers_verified: 0,
        count_servers_legit: 0,
        count_servers_spam: 0,
        count_players_total: 0,
        count_players_verified: 0,
        count_players_legit: 0,
        count_players_spam: 0,
    };
    tracker.reset();
    filterStats = {
        count_cyrillic: 0,
        count_emoji: 0,
        count_custom_string: 0,
        count_player_spoof: 0,
        count_ip_address: 0,
        count_subnet: 0,
    };
    updateCounter(stats);
}

function printSummary(tab: string) {
    console.info(`%c[pureBrowser] Tab: ${tab} Total: ${stats.count_servers_total} Good: ${stats.count_servers_legit} Bad: ${stats.count_servers_spam}`, 'color:#0f0;');
    console.info(`%c  Emojis: ${filterStats.count_emoji} Cyrillic: ${filterStats.count_cyrillic} Custom String: ${filterStats.count_custom_string} Player Spoofing: ${filterStats.count_player_spoof} IP: ${filterStats.count_ip_address} Subnet: ${filterStats.count_subnet}`, 'color:#afa;');
}

/*
    DOM RESOLUTION
*/
declare global {
    interface Window {
        SteamClient?: { ServerBrowser?: ServerBrowserAPI };
        __pureBrowserHooked?: boolean;
    }
}

function resolveDocument(ctx: any): Document | null {
    const candidates: any[] = [
        ctx,
        ctx?.m_element,
        ctx?.m_popup,
        ctx?.window,
        ctx?.m_element?.window,
        ctx?.m_popup?.window,
        ctx?.m_element?.contentWindow,
    ];
    for (const c of candidates) {
        if (c == null) continue;
        try {
            if (c.document && typeof c.document.createElement === 'function') return c.document;
            if (c.createElement && typeof c.createElement === 'function') return c as Document;
        } catch (_) {
            /* cross-context access may throw */
        }
    }
    return null;
}

function tryInjectWhenReady(doc: Document): void {
    const attempt = () => {
        const title = doc.title ?? '';
        if (title.includes('Game Servers')) {
            console.log('[pureBrowser] Injecting into Game Servers window');
            injectCounter(doc);
            injectRowHighlighter(doc);
            injectVerifiedToggle(doc);
            injectVerifiedBar(doc);
        }
    };

    if (doc.readyState === 'complete' || doc.readyState === 'interactive') {
        attempt();
    } else {
        doc.addEventListener('DOMContentLoaded', attempt, { once: true });
    }
}

function windowCreated(context: any): void {
    const title: string = context?.m_strTitle ?? '';
    
    if (!title.includes('Game Servers')) {
        return;
    }

    const name: string = context?.m_strName ?? '';
    console.log('[pureBrowser] Found Game Servers window:', name);

    const doc = resolveDocument(context);
    if (doc) {
        tryInjectWhenReady(doc);
        return;
    }

    console.log('[pureBrowser] doc not available yet, retrying in 600ms');
    setTimeout(() => {
        const d = resolveDocument(context);
        if (d) {
            tryInjectWhenReady(d);
        } else {
            console.log('[pureBrowser] retry failed');
        }
    }, 600);
}

function onServerFiltered(srv: ServerEntry, onServer: OnServerCb): void {
    stats.count_servers_total++;
    const sname = String(srv?.name ?? srv?.m_szServerName ?? srv?.strName ?? '<unknown>');
    const ip = String(srv?.ip ?? srv?.addr ?? '');
    const players = Number(srv?.players ?? srv?.nPlayers ?? srv?.numPlayers ?? 0);
    stats.count_players_total += players;

    const shouldKeep = filterServer(srv, ip, tracker, filterStats);

    if (!shouldKeep) {
        stats.count_servers_spam++;
        stats.count_players_spam += players;
        scheduleUpdateCounter(stats);
        return;
    }

    stats.count_servers_legit++;
    stats.count_players_legit += players;
    if (VERIFIED_NAME_RE.test(sname)) {
        stats.count_servers_verified++;
        stats.count_players_verified += players;
    }

    scheduleUpdateCounter(stats);
    if (typeof onServer === 'function') onServer(srv);
}

function onRequestComplete(serverTab: string, onComplete: OnCompleteCb, result: unknown): void {
    const suspiciousIPs = tracker.getSuspiciousIPs();

    printSummary(serverTab);

    if (suspiciousIPs.length > 0) {
        console.info(`%c[pureBrowser] Suspicious IP Concentrations:`, 'color:#ff6b6b;');
        for (const s of suspiciousIPs) {
            const label = s.type === 'single' ? `${s.ip}` : `/24 ${s.ip}.0`;
            console.info(`%c  ${label}: ${s.total} servers`, 'color:#ff6b6b;');
        }
    }

    if (typeof onComplete === 'function') onComplete(result);
}

/*
    CORE HOOK
*/
function installHook() {
    const SB = window.SteamClient?.ServerBrowser;
    if (!SB) {
        console.error('[pureBrowser] SteamClient.ServerBrowser not available');
        return;
    }
    if (window.__pureBrowserHooked) return;

    const origCreate = SB.CreateServerListRequest.bind(SB);

    SB.CreateServerListRequest = (appid, serverTab, prefs, onServer, onComplete) => {
        resetCounters();

        const filteredOnServer: OnServerCb = (srv) => onServerFiltered(srv, onServer);
        const wrappedOnComplete: OnCompleteCb = (result) => onRequestComplete(serverTab, onComplete, result);

        return origCreate(appid, serverTab, prefs, filteredOnServer, wrappedOnComplete);
    };

    window.__pureBrowserHooked = true;
    console.log('[pureBrowser] ServerBrowser hooked');
}

/*
    PLUGIN ENTRY POINT
*/
export default definePlugin(() => {
    Millennium.AddWindowCreateHook((ctx: any) => {
        windowCreated(ctx);
        installHook();
    });

    installHook();

    return {
        title: 'pureBrowser',
        icon: <IconsModule.Settings />,
        content: <SettingsPanel />,
    };
});