import React, { useState } from 'react';
import { SliderField, Field, DialogButton, TextField, ToggleField } from '@steambrew/client';
import { BrowserStats } from './types';
import { VERIFIED_NAME_RE } from './constants';



export const verifiedColor = '#00a2ffb3';
export const goodColor = '#4cec0d';
export const badColor = '#fc3737';
export const neutralColor = '#d8d8d8';
export const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="${verifiedColor}"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z"></path></svg>`;
export const NAME_CELL = '._2GEwuCDW8CeZyS7UOQ0aF6';
export const ROW_SEL = 'div[role="row"].c8HfPY9sQZdSZtTna_qYB';

let counterEl: HTMLElement | null = null;
let updateCounterPending = false;
let verifiedOnly = false;
let verifiedBarEl: HTMLElement | null = null;

const CONFIG_KEY = 'plugin_purebrowser_config';

interface PluginSettings {
    ip_address_threshold: number;
    ip_subnet_threshold: number;
    blocked_patterns: string[];
    show_statistics: boolean;
    filter_emoji: boolean;
    filter_cyrillic: boolean;
    filter_custom_string: boolean;
    filter_player_spoof: boolean;
    filter_ip_concentration: boolean;
    filter_subnet_concentration: boolean;
}

const loadSettings = (): PluginSettings => {
    try {
        const stored = localStorage.getItem(CONFIG_KEY);
        const defaults = { ip_address_threshold: 50, ip_subnet_threshold: 50, blocked_patterns: [], show_statistics: true, filter_emoji: true, filter_cyrillic: true, filter_custom_string: true, filter_player_spoof: true, filter_ip_concentration: true, filter_subnet_concentration: true };
        return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
        return { ip_address_threshold: 30, ip_subnet_threshold: 50, blocked_patterns: [], show_statistics: true, filter_emoji: true, filter_cyrillic: true, filter_custom_string: true, filter_player_spoof: true, filter_ip_concentration: true, filter_subnet_concentration: true };
    }
};

const saveSettings = (settings: PluginSettings): void => {
    try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('[pureBrowser] Failed to save settings:', e);
    }
};

export const SettingsPanel: React.FC = () => {
    const [settings, setSettings] = useState<PluginSettings>(loadSettings);

    const update = (key: keyof PluginSettings, value: number) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        saveSettings(next);
    };

    const updateIPThreshold = (value: string) => {
        const num = Math.max(1, parseInt(value, 10) || 50);
        update('ip_address_threshold', num);
    };

    const [draft, setDraft] = useState(() => settings.blocked_patterns.join('\n'));
    const [errors, setErrors] = useState<number[]>([]);

    const applyPatterns = () => {
        const lines = draft.split('\n').map((l) => l.trim()).filter(Boolean);
        const badLines: number[] = [];
        lines.forEach((p, i) => {
            try {
                const literalMatch = p.match(/^\/(.+)\/([gimsuy]*)$/);
                if (literalMatch) {
                    new RegExp(literalMatch[1], literalMatch[2] || 'i');
                } else {
                    new RegExp(p, 'i');
                }
            } catch { badLines.push(i); }
        });
        if (badLines.length > 0) {
            setErrors(badLines);
            return;
        }
        setErrors([]);
        const next = { ...settings, blocked_patterns: lines };
        setSettings(next);
        saveSettings(next);
    };

    const clearPatterns = () => {
        setDraft('');
        setErrors([]);
        const next = { ...settings, blocked_patterns: [] };
        setSettings(next);
        saveSettings(next);
    };

    const toggleFilter = (key: keyof PluginSettings, value: boolean) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        saveSettings(next);
    };

    return (
        <>
            <ToggleField label="Statistics Counter" description="Show server filter statistics in the Game Servers window header" checked={settings.show_statistics} onChange={(v) => toggleFilter('show_statistics', v)} />
            <ToggleField label="Emoji Filter" description="Block servers with emoji in the name" checked={settings.filter_emoji} onChange={(v) => toggleFilter('filter_emoji', v)} />
            <ToggleField label="Cyrillic Filter" description="Block servers with Cyrillic characters in the name" checked={settings.filter_cyrillic} onChange={(v) => toggleFilter('filter_cyrillic', v)} />
            <ToggleField label="Custom String Filter" description="Block servers matching patterns from the list below" checked={settings.filter_custom_string} onChange={(v) => toggleFilter('filter_custom_string', v)} />
            <ToggleField label="Player Spoof Filter" description="Block servers reporting more than 64 players/slots" checked={settings.filter_player_spoof} onChange={(v) => toggleFilter('filter_player_spoof', v)} />
            <ToggleField label="IP Concentration Filter" description="Block servers when too many share one IP" checked={settings.filter_ip_concentration} onChange={(v) => toggleFilter('filter_ip_concentration', v)} />
            <ToggleField label="Subnet Concentration Filter" description="Block servers when too many share one /24 subnet" checked={settings.filter_subnet_concentration} onChange={(v) => toggleFilter('filter_subnet_concentration', v)} />
            <Field
                label="IP Address Threshold"
                description="Max servers allowed per IP address before filtering (accounts for multi-port hosting)"
                bottomSeparator="standard"
            >
                <TextField
                    value={String(settings.ip_address_threshold)}
                    onChange={(e) => updateIPThreshold(e.target.value)}
                    mustBeNumeric
                />
            </Field>
            <SliderField
                label="IP Subnet Threshold (/24)"
                description="Max servers allowed per /24 subnet before filtering"
                value={settings.ip_subnet_threshold}
                min={1}
                max={256}
                step={1}
                showValue
                editableValue
                onChange={(v) => update('ip_subnet_threshold', v)}
            />

            <Field
                label="Blocked Server Patterns"
                description={errors.length > 0 ? `Invalid regex on line(s): ${errors.map((i) => i + 1).join(', ')}` : `${settings.blocked_patterns.length} active pattern(s). Plain-text or RegEx, one entry per line. Uses ECMAScript, example on GitHub.`}
                bottomSeparator="none"
                childrenContainerWidth="max"
                childrenLayout="below"
            >
                <textarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setErrors([]); }}
                    rows={10}
                    spellCheck={false}
                    style={{
                        width: '100%',
                        background: '#1a1a1a',
                        border: `1px solid ${errors.length > 0 ? '#c0392b' : '#444'}`,
                        borderRadius: '4px',
                        color: '#e0e0e0',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '8px',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                    }}
                />
            </Field>
            <Field bottomSeparator="thick" childrenContainerWidth="min">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <DialogButton onClick={applyPatterns} style={{ padding: '4px 16px' }}>
                        Apply
                    </DialogButton>
                    <DialogButton onClick={clearPatterns} style={{ padding: '4px 16px', background: '#8b0000' }}>
                        Clear All
                    </DialogButton>
                </div>
            </Field>
        </>
    );
};

/*
    COUNTER DISPLAY
*/
export function buildCounter(stats: BrowserStats): string {
    const td = (color: string, w: number, content: string, isHeader = false) =>
        `<td style="width:${w}px;min-width:${w}px;max-width:${w}px;color:${color};padding:${isHeader ? '0 6px 3px 0' : '1px 6px 1px 0'};white-space:nowrap;overflow:hidden">${content}</td>`;
    const th = (color: string, w: number, content: string) => td(color, w, content, true);
    const tableStyle = 'border-collapse:collapse;font-size:11px;line-height:1.5;table-layout:fixed;vertical-align:top';

    return `<div style="display:flex;align-items:flex-start;gap:0">` +
        `<table style="${tableStyle}">` +
        `<colgroup><col style="width:80px"><col style="width:56px"><col style="width:48px"><col style="width:44px"><col style="width:48px"></colgroup>` +
        `<thead><tr style="opacity:0.55">` +
        th(neutralColor, 80, 'OVERVIEW') +
        th(verifiedColor, 56, 'VERIFIED') +
        th(goodColor, 48, 'GOOD') +
        th(badColor, 44, 'BAD') +
        th(neutralColor, 48, 'TOTAL') +
        `</tr></thead>` +
        `<tbody>` +
        `<tr>` +
        td(neutralColor, 80, `SERVERS`) +
        td(verifiedColor, 56, String(stats.count_servers_verified || '-')) +
        td(goodColor, 48, String(stats.count_servers_legit || '-')) +
        td(badColor, 44, String(stats.count_servers_spam || '-')) +
        td(neutralColor, 48, String(stats.count_servers_total || '-')) +
        `</tr>` +
        `<tr>` +
        td(neutralColor, 80, `PLAYERS`) +
        td(verifiedColor, 56, String(stats.count_players_verified || '-')) +
        td(goodColor, 48, String(stats.count_players_legit || '-')) +
        td(badColor, 44, String(stats.count_players_spam || '-')) +
        td(neutralColor, 48, String(stats.count_players_total || '-')) +
        `</tr>` +
        `</tbody></table>` +
        `</div>`;
}

export function injectCounter(doc: Document): void {
    try {
        const stored = localStorage.getItem(CONFIG_KEY);
        const config = stored ? JSON.parse(stored) : {};
        if (config.show_statistics === false) return;
    } catch { /* ignore */ }

    if (doc.getElementById('pure-counter')) return;

    const tryInsert = () => {
        const header = doc.querySelector('.DialogHeader');
        if (!header || doc.getElementById('pure-counter')) return false;

        const el = doc.createElement('span');
        el.id = 'pure-counter';
        el.style.cssText = [
            'padding: 3px',
            'background: #1f2227',
            'border: 1px solid rgba(255,255,255,0.15)',
            'font-size:13px',
            'font-weight:300',
            'margin-left:18px',
            'display:inline-flex',
            'flex-direction:row',
            'align-items:center',
            'gap:8px',
            'vertical-align:middle',
        ].join(';');

        const statsDiv = doc.createElement('div');
        statsDiv.id = 'pure-stats';
        statsDiv.style.cssText = 'display:flex;flex-direction:column;gap:1px;align-items:flex-start';
        statsDiv.innerHTML = `<span style="color: ${goodColor}">pureBrowser loaded</span>`;

        el.appendChild(statsDiv);
        header.appendChild(el);
        counterEl = statsDiv;
        return true;
    };

    if (tryInsert()) return;

    const root = doc.body ?? doc.documentElement;
    const obs = new MutationObserver(() => tryInsert());
    obs.observe(root, { childList: true, subtree: true });
}

export function updateCounter(stats: BrowserStats): void {
    if (!counterEl) return;
    counterEl.innerHTML = buildCounter(stats);
}

export function scheduleUpdateCounter(stats: BrowserStats): void {
    if (updateCounterPending) return;
    updateCounterPending = true;

    setTimeout(() => {
        updateCounterPending = false;
        updateCounter(stats);
    }, 250);
}

/*
    ROW HIGHLIGHT
*/
export function injectRowHighlighter(doc: Document): void {
    if (!doc.getElementById('pure-row-style')) {
        const s = doc.createElement('style');
        s.id = 'pure-row-style';
        s.textContent =
            `${ROW_SEL}.pure-verified-row {` +
            ` background: #2f90ff0c !important;` +
            ` border-left:3px solid ${verifiedColor} !important; }\n` +
            `.pure-star { color:#4fc3f7 !important; margin-right:5px !important; flex-shrink:0 !important; vertical-align:middle !important; display:inline-flex !important; align-items:center !important; }`;
        doc.head.appendChild(s);
    }

    const rowTextCache = new WeakMap<Element, string>();
    const popupWin = doc.defaultView as (Window & typeof globalThis);
    let rafId = 0;
    let selectedRow: Element | null = null;

    const updateRowHighlight = (row: Element) => {
        const cell = row.querySelector(NAME_CELL) as HTMLElement | null;
        if (!cell) return;

        const rawText = (cell.textContent ?? '').trim();
        const prevText = rowTextCache.get(row);
        rowTextCache.set(row, rawText);

        if (prevText && prevText !== rawText) {
            cell.querySelector('.pure-star')?.remove();
        }

        const existingStar = cell.querySelector<HTMLElement>('.pure-star');
        const cleanName = existingStar
            ? rawText.replace(existingStar.textContent ?? '', '').trim()
            : rawText;

        const isVerified = cleanName && VERIFIED_NAME_RE.test(cleanName);
        const isSteamSelected = (row as HTMLElement).getAttribute('data-is-selected') === 'true';

        if (isVerified && !isSteamSelected) {
            row.classList.add('pure-verified-row');
            if (!existingStar) {
                const star = doc.createElement('span');
                star.className = 'pure-star';
                star.innerHTML = SVG_CHECK;
                cell.insertAdjacentElement('afterbegin', star);
            }
        } else {
            row.classList.remove('pure-verified-row');
            existingStar?.remove();
        }
    };

    const scheduleTag = () => {
        if (rafId) return;
        rafId = popupWin.requestAnimationFrame(() => {
            rafId = 0;
            doc.querySelectorAll(ROW_SEL).forEach(updateRowHighlight);
        });
    };

    const handleClick = (e: MouseEvent) => {
        const clickedRow = (e.target as HTMLElement)?.closest(ROW_SEL) as HTMLElement | null;
        const wasSelected = selectedRow;
        selectedRow = clickedRow && e.currentTarget === (e.composedPath?.()?.[0] ?? doc) ? clickedRow : null;

        if (wasSelected && wasSelected !== clickedRow) {
            wasSelected.setAttribute('data-is-selected', 'false');
        }
        if (selectedRow) {
            selectedRow.setAttribute('data-is-selected', 'true');
        }
        if (wasSelected !== selectedRow) {
            scheduleTag();
        }
    };

    scheduleTag();
    const tableRoot = doc.querySelector('[role="table"]') ?? doc.body ?? doc.documentElement;
    tableRoot?.addEventListener('click', handleClick);
    doc.addEventListener('click', handleClick);

    const obs = new MutationObserver(scheduleTag);
    obs.observe(tableRoot, { childList: true, subtree: true, characterData: true });
}

/*
    FILTER BUTTONS
*/
const DIALOG_CHECK_SVG = `<svg version="1.1" id="base" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_DialogCheck" x="0px" y="0px" width="256px" height="256px" viewBox="0 0 256 256"><defs><linearGradient id="svgid_pure_1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00ccff"></stop><stop offset="100%" stop-color="#2d73ff"></stop></linearGradient><filter id="svgid_pure_2" x="0" y="0" width="200%" height="200%"><feOffset result="offOut" in="SourceAlpha" dx="20" dy="20"></feOffset><feGaussianBlur result="blurOut" in="offOut" stdDeviation="10"></feGaussianBlur><feBlend in="SourceGraphic" in2="blurOut" mode="normal"></feBlend></filter></defs><path fill="none" stroke="url(#svgid_pure_1)" stroke-width="24" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="10" d="M206.5,45.25L95,210.75l-45.5-63" stroke-dasharray="365.19 365.19" stroke-dashoffset="0.00"></path><path fill="none" opacity=".2" filter="url(#svgid_pure_2)" stroke="url(#svgid_pure_1)" stroke-width="24" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="10" d="M206.5,45.25L95,210.75l-45.5-63" stroke-dasharray="365.19 365.19" stroke-dashoffset="0.00"></path></svg>`;

function updateVerifiedBar(): void {
    if (!verifiedBarEl) return;
    verifiedBarEl.textContent = verifiedOnly ? '; is verified' : '';
}

export function injectVerifiedToggle(doc: Document): void {
    const popupWin = doc.defaultView as any;

    const patchTabState = (tabState: any) => {
        if (!tabState || tabState.__pureBrowserFlushPatched) return;
        const orig = tabState.FlushPendingServers.bind(tabState);
        tabState.FlushPendingServers = function () {
            orig();
            if (verifiedOnly) {
                tabState.filtered_servers = tabState.filtered_servers.filter(
                    (s: any) => VERIFIED_NAME_RE.test(String(s.name ?? ''))
                );
                tabState.Modified();
            }
        };
        tabState.__pureBrowserFlushPatched = true;
    };

    const findStore = (): any => {
        for (const w of [popupWin, popupWin?.opener, popupWin?.top, popupWin?.parent]) {
            try { if (w?.serverBrowserStore?.GetTabState) return w.serverBrowserStore; } catch { /* cross-origin */ }
        }

        const anchor = doc.querySelector('[role="table"]')
            ?? doc.querySelector('._2SvsKGOQeIoV8laKj5Ql5s')
            ?? doc.querySelector('._2X_ZpO2X_CIOIEfml3ZTcX');
        if (!anchor) return null;

        const fiberKey = Object.keys(anchor).find(k =>
            k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
        );
        if (!fiberKey) return null;

        let fiber = (anchor as any)[fiberKey];
        for (let depth = 0; depth < 50 && fiber; depth++) {
            if (fiber.stateNode?.GetTabState) return fiber.stateNode;

            const props = fiber.memoizedProps;
            if (props && typeof props === 'object') {
                if ((props as any).GetTabState) return props;
                for (const val of Object.values(props)) {
                    if (val && typeof val === 'object' && (val as any).GetTabState) return val;
                }
            }

            let state = fiber.memoizedState;
            for (let j = 0; j < 10 && state; j++) {
                const mem = state.memoizedState;
                if (mem?.GetTabState) return mem;
                state = state.next;
            }

            fiber = fiber.return;
        }
        return null;
    };

    const tryInsert = () => {
        if (doc.getElementById('pure-verified-toggle')) return;

        const checkboxColumn = doc.querySelector('.wEGw5DGwuG9ietThudkhS') as HTMLElement | null;
        if (!checkboxColumn) return;

        if (!doc.getElementById('pure-filter-height')) {
            const s = doc.createElement('style');
            s.id = 'pure-filter-height';
            s.textContent = [
                '._1EKWPcG8fTbIjt4XH51i5B:not(._1ezaeFk0i2IVfJTyujGL3-) { height: 170px !important; }',
            ].join('\n');
            doc.head.appendChild(s);
        }

        const container = doc.createElement('div');
        container.id = 'pure-verified-toggle';
        container.setAttribute('role', 'checkbox');
        container.setAttribute('aria-checked', String(verifiedOnly));
        container.className = 'DialogCheckbox_Container _DialogLayout Panel';
        container.setAttribute('tabindex', '0');

        const checkDiv = doc.createElement('div');
        checkDiv.className = 'DialogCheckbox';
        checkDiv.innerHTML = DIALOG_CHECK_SVG;

        const labelDiv = doc.createElement('div');
        labelDiv.className = 'DialogToggle_Label';
        labelDiv.innerHTML = '<span>Verified servers</span>';

        const clearDiv = doc.createElement('div');
        clearDiv.style.cssText = 'clear: left;';

        container.appendChild(checkDiv);
        container.appendChild(labelDiv);
        container.appendChild(clearDiv);
        checkboxColumn.appendChild(container);

        const activate = () => {
            verifiedOnly = !verifiedOnly;
            container.setAttribute('aria-checked', String(verifiedOnly));
            checkDiv.classList.toggle('Active', verifiedOnly);
            updateVerifiedBar();

            const store = findStore();
            if (!store) {
                console.warn('[pureBrowser] tab-state store not found — toggle is visual only');
                return;
            }

            for (const id of ['internet', 'favorites', 'history', 'lan', 'friends']) {
                patchTabState(store.GetTabState(id));
            }

            const tabId = store.m_activeTab ?? 'internet';
            const tabState = store.GetTabState(tabId);
            patchTabState(tabState);
            tabState?.FlushPendingServers();
        };

        container.addEventListener('click', activate);
        container.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); activate(); }
        });
    };

    tryInsert();

    const root = doc.body ?? doc.documentElement;
    const obs = new MutationObserver(() => tryInsert());
    obs.observe(root, { childList: true, subtree: true });
}

export function injectVerifiedBar(doc: Document): void {
    const tryInsert = () => {
        if (doc.getElementById('pure-verified-bar')) return;
        const filterTextSpan = doc.querySelector('._9Ah3c27-EWzVbXgRoFZz6') as HTMLElement | null;
        if (!filterTextSpan) return;

        const bar = doc.createElement('span');
        bar.id = 'pure-verified-bar';
        bar.style.cssText = 'opacity:0.75;';
        verifiedBarEl = bar;
        filterTextSpan.appendChild(bar);
        updateVerifiedBar();
    };

    tryInsert();
    const root = doc.body ?? doc.documentElement;
    const obs = new MutationObserver(() => tryInsert());
    obs.observe(root, { childList: true, subtree: true });
}