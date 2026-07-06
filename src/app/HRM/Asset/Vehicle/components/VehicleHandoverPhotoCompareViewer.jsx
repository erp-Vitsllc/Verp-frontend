'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_SLIDER_STEP = 1;
const WHEEL_ZOOM_STEP = 0.08;

function clampZoom(value) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function ComparePane({ label, tone, photoUrl, comment }) {
    const isPrevious = tone === 'previous';
    const headerClass = isPrevious ? 'bg-emerald-600' : 'bg-red-600';
    const borderClass = isPrevious ? 'border-emerald-400' : 'border-red-400';
    const accentClass = isPrevious ? 'accent-emerald-600' : 'accent-red-600';
    const thumbClass = isPrevious
        ? '[&::-webkit-slider-thumb]:bg-emerald-600 [&::-moz-range-thumb]:bg-emerald-600'
        : '[&::-webkit-slider-thumb]:bg-red-600 [&::-moz-range-thumb]:bg-red-600';

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const viewportRef = useRef(null);
    const dragRef = useRef({
        active: false,
        startX: 0,
        startY: 0,
        panStartX: 0,
        panStartY: 0,
    });

    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [photoUrl]);

    const handleZoomChange = useCallback((value) => {
        setZoom(clampZoom(value));
    }, []);

    const handleWheel = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY > 0 ? -1 : 1;
        setZoom((prev) => clampZoom(prev + direction * WHEEL_ZOOM_STEP));
    }, []);

    const handlePointerDown = useCallback(
        (event) => {
            if (event.button !== 0 || zoom <= 1) return;
            event.preventDefault();
            dragRef.current = {
                active: true,
                startX: event.clientX,
                startY: event.clientY,
                panStartX: pan.x,
                panStartY: pan.y,
            };
            setIsDragging(true);
            viewportRef.current?.setPointerCapture(event.pointerId);
        },
        [pan.x, pan.y, zoom],
    );

    const handlePointerMove = useCallback((event) => {
        if (!dragRef.current.active) return;
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        setPan({
            x: dragRef.current.panStartX + dx,
            y: dragRef.current.panStartY + dy,
        });
    }, []);

    const endDrag = useCallback((event) => {
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        setIsDragging(false);
        if (event?.pointerId != null) {
            viewportRef.current?.releasePointerCapture(event.pointerId);
        }
    }, []);

    useEffect(() => {
        if (zoom <= 1) setPan({ x: 0, y: 0 });
    }, [zoom]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return undefined;
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const zoomPercent = Math.round(zoom * 100);
    const canPan = zoom > 1;

    return (
        <div className={`flex h-full min-h-0 flex-1 flex-col border-r last:border-r-0 ${borderClass} border-2`}>
            <div
                className={`shrink-0 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white ${headerClass}`}
            >
                {label}
            </div>

            <div
                ref={viewportRef}
                className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-950 select-none ${
                    canPan ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {photoUrl ? (
                    <div
                        className="flex h-full w-full items-center justify-center p-4"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 120ms ease-out',
                        }}
                    >
                        <img
                            src={photoUrl}
                            alt={label}
                            className="max-h-full max-w-full object-contain pointer-events-none"
                            draggable={false}
                        />
                    </div>
                ) : (
                    <p className="text-sm text-slate-400">No photo</p>
                )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-slate-900 px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Zoom
                    </span>
                    <input
                        type="range"
                        min={MIN_ZOOM * 100}
                        max={MAX_ZOOM * 100}
                        step={ZOOM_SLIDER_STEP}
                        value={zoomPercent}
                        onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                        aria-label={`${label} zoom level`}
                        className={`h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 ${accentClass} ${thumbClass} [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0`}
                    />
                    <span className="min-w-[40px] shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-200">
                        {zoomPercent}%
                    </span>
                </div>
                <p className="mt-1 text-center text-[9px] text-slate-500">
                    Scroll to zoom · drag when zoomed in
                </p>
            </div>

            {comment ? (
                <div
                    className={`shrink-0 border-t px-4 py-3 text-sm ${
                        isPrevious
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-red-200 bg-red-50 text-red-900'
                    }`}
                >
                    <span className="font-semibold">Comment: </span>
                    {comment}
                </div>
            ) : null}
        </div>
    );
}

export default function VehicleHandoverPhotoCompareViewer({
    open,
    viewLabel = '',
    previousPhotoUrl = null,
    currentPhotoUrl = null,
    previousComment = '',
    currentComment = '',
    onClose,
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!mounted || !open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 text-white">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Compare to previous
                    </p>
                    <h3 className="truncate text-lg font-bold">{viewLabel}</h3>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close comparison"
                >
                    <X size={22} />
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                <ComparePane
                    label="Previous (50%)"
                    tone="previous"
                    photoUrl={previousPhotoUrl}
                    comment={previousComment}
                />
                <ComparePane
                    label="Current (50%)"
                    tone="current"
                    photoUrl={currentPhotoUrl}
                    comment={currentComment}
                />
            </div>
        </div>,
        document.body,
    );
}
