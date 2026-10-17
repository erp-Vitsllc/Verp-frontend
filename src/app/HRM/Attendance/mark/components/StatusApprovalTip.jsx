'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const PANEL_WIDTH = 440;

function formatApprovedDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).formatToParts(date);
    const day = parts.find((part) => part.type === 'day')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const year = parts.find((part) => part.type === 'year')?.value;
    if (!day || !month || !year) return '—';
    return `${day}-${month}-${year}`;
}

function placePanel(anchor) {
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const estimatedHeight = 220;
    const below = rect.bottom + 6;
    const top = below + estimatedHeight > window.innerHeight && rect.top > estimatedHeight
        ? Math.max(8, rect.top - estimatedHeight - 6)
        : below;
    return { top, left, width };
}

export default function StatusApprovalTip({ approvals, statusTitle, className, children }) {
    const rows = Array.isArray(approvals) ? approvals : [];
    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const closeTimer = useRef(null);
    const pinnedRef = useRef(false);
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [box, setBox] = useState(null);

    const updatePinned = (next) => {
        pinnedRef.current = next;
        setPinned(next);
        return next;
    };

    const clearClose = () => {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };

    const show = () => {
        clearClose();
        setBox(placePanel(anchorRef.current));
        setOpen(true);
    };

    const scheduleHide = () => {
        clearClose();
        if (pinnedRef.current) return;
        closeTimer.current = window.setTimeout(() => {
            if (!pinnedRef.current) setOpen(false);
        }, 160);
    };

    useEffect(() => () => clearClose(), []);

    useEffect(() => {
        if (!open) return undefined;
        const update = () => setBox(placePanel(anchorRef.current));
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open]);

    useEffect(() => {
        if (!pinned) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') {
                updatePinned(false);
                setOpen(false);
            }
        };
        const onDown = (event) => {
            const target = event.target;
            if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            updatePinned(false);
            setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [pinned]);

    const panel = open && box && typeof document !== 'undefined'
        ? createPortal(
            <div
                ref={panelRef}
                role="tooltip"
                style={{ top: box.top, left: box.left, width: box.width }}
                className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-lg"
                onMouseEnter={show}
                onMouseLeave={scheduleHide}
            >
                <div className="border-b border-slate-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Requests and approvals
                    </p>
                    {statusTitle ? <p className="mt-0.5 text-xs text-slate-700">{statusTitle}</p> : null}
                </div>
                {rows.length ? (
                    <div className="max-h-64 overflow-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 font-bold">Type</th>
                                    <th className="px-3 py-2 font-bold whitespace-nowrap">Approved date</th>
                                    <th className="px-3 py-2 font-bold">Who approved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id || `${row.type}-${row.approvedAt}`} className="border-t border-slate-100">
                                        <td className="px-3 py-2 font-medium text-slate-800">{row.type || 'Request'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-600">
                                            {formatApprovedDate(row.approvedAt)}
                                        </td>
                                        <td className="px-3 py-2 text-slate-700">{row.approvedBy || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="px-3 py-3 text-xs text-slate-500">No requests or approvals for this day.</p>
                )}
            </div>,
            document.body,
        )
        : null;

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                className={className}
                aria-expanded={open}
                aria-pressed={pinned}
                aria-label={statusTitle || 'Attendance status'}
                onMouseEnter={show}
                onMouseLeave={scheduleHide}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    clearClose();
                    if (pinnedRef.current) {
                        updatePinned(false);
                        setOpen(false);
                        return;
                    }
                    updatePinned(true);
                    setOpen(true);
                }}
            >
                {children}
            </button>
            {panel}
        </>
    );
}
