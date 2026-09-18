'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PUNCH_TYPE_STYLES = {
    app: 'text-sky-800 bg-sky-50',
    web: 'text-indigo-800 bg-indigo-50',
    manual: 'text-slate-700 bg-slate-100',
};

function prefersAppleMaps() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !/Chrome|CriOS|Android/.test(navigator.userAgent);
}

export function normalizePunchType(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (raw === 'app' || raw === 'portalapp' || raw === 'mobile') return 'app';
    if (raw === 'web' || raw === 'website' || raw === 'dashboard') return 'web';
    if (raw === 'manual' || raw === 'hr' || raw === 'mark') return 'manual';
    return '';
}

export function punchCoords(location) {
    if (!location || typeof location !== 'object') return null;
    const latRaw = location.latitude ?? location.lat;
    const lngRaw = location.longitude ?? location.lng ?? location.lon;
    if (latRaw == null || latRaw === '' || lngRaw == null || lngRaw === '') return null;
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return {
        latitude,
        longitude,
        accuracy: Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : null,
        label: String(location.label || '').trim(),
        source: normalizePunchType(location.source),
    };
}

function mapsHref(coords, label) {
    if (!coords) return null;
    const { latitude, longitude } = coords;
    const query = encodeURIComponent(label || `${latitude},${longitude}`);
    if (prefersAppleMaps()) {
        return {
            href: `https://maps.apple.com/?ll=${latitude},${longitude}&q=${query}`,
            provider: 'Apple Maps',
        };
    }
    return {
        href: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        provider: 'Google Maps',
    };
}

function osmEmbedUrl(coords) {
    const lat = coords.latitude;
    const lng = coords.longitude;
    const delta = 0.006;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function formatClock(value) {
    if (!value || value === '—') return '';
    const s = String(value).trim();
    if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
    return s;
}

function PunchTypeBadge({ type }) {
    if (!type) return null;
    return (
        <span
            className={`inline-flex w-fit text-[11px] font-medium px-2 py-1 rounded capitalize ${
                PUNCH_TYPE_STYLES[type] || 'text-slate-700 bg-slate-100'
            }`}
        >
            {type}
        </span>
    );
}

export function PunchTypeCell({ punchSource, checkOutSource, timeOut }) {
    const inType = normalizePunchType(punchSource);
    const outType = normalizePunchType(checkOutSource);
    const hasOut = Boolean(formatClock(timeOut) || outType);

    if (!inType && !outType) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    if (hasOut && outType && inType && outType !== inType) {
        return (
            <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">In</span>
                    <PunchTypeBadge type={inType} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Out</span>
                    <PunchTypeBadge type={outType} />
                </span>
            </div>
        );
    }

    return <PunchTypeBadge type={inType || outType} />;
}

function titleForKind(kind) {
    if (kind === 'out') return 'Check-out location';
    if (kind === 'web') return 'Web login location';
    if (kind === 'app') return 'App login location';
    return 'Check-in location';
}

export function LocationMapPin({ coords, time = '', kind = 'in' }) {
    if (!coords) return null;
    return <LocationPinButton coords={coords} time={time} kind={kind} />;
}

function LocationPinButton({ coords, time, kind }) {
    const maps = mapsHref(coords, coords.label || titleForKind(kind));
    const title = titleForKind(kind);
    const pinClass =
        kind === 'out' ? 'text-sky-600' : kind === 'web' ? 'text-indigo-600' : 'text-[#EA3D2F]';

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="group inline-flex flex-col items-center gap-0.5 rounded-md px-1 py-0.5 hover:bg-slate-100 transition-colors"
                    title={`${title} — click to view map`}
                    aria-label={title}
                >
                    <span className="relative flex h-8 w-7 items-end justify-center">
                        <span className="absolute bottom-0 h-1 w-3 rounded-full bg-black/15 blur-[1px]" />
                        <MapPin
                            size={26}
                            className={`relative ${pinClass} drop-shadow-sm transition group-hover:-translate-y-0.5`}
                            fill="currentColor"
                            strokeWidth={1.6}
                        />
                    </span>
                    {time ? (
                        <span className="text-[10px] font-semibold tabular-nums text-gray-600">{time}</span>
                    ) : null}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden" align="start" side="bottom">
                <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900">{title}</p>
                    <p className="text-[11px] text-gray-500 tabular-nums mt-0.5">
                        {time ? `${time} · ` : ''}
                        {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    </p>
                    {coords.label ? (
                        <p className="text-[11px] text-gray-600 mt-0.5 truncate" title={coords.label}>
                            {coords.label}
                        </p>
                    ) : null}
                </div>
                <iframe
                    title={title}
                    src={osmEmbedUrl(coords)}
                    className="w-full h-44 border-0 bg-slate-100"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
                {maps ? (
                    <a
                        href={maps.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 border-t border-gray-100"
                    >
                        Open in {maps.provider}
                        <ExternalLink size={12} />
                    </a>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}

export function PunchLocationPinCell({ location, time, kind = 'in' }) {
    const coords = punchCoords(location);
    if (!coords) {
        return <span className="text-sm text-gray-400">—</span>;
    }
    return <LocationMapPin coords={coords} time={formatClock(time)} kind={kind} />;
}
