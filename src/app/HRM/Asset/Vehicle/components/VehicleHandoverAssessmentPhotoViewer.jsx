'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_SLIDER_STEP = 1;
const WHEEL_ZOOM_STEP = 0.08;

function clampZoom(value) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export default function VehicleHandoverAssessmentPhotoViewer({
    open,
    items = [],
    startIndex = 0,
    onClose,
    onCompare,
}) {
    const [index, setIndex] = useState(startIndex);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const viewportRef = useRef(null);
    const dragRef = useRef({
        active: false,
        startX: 0,
        startY: 0,
        panStartX: 0,
        panStartY: 0,
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (open) {
            setIndex(Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)));
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }
    }, [open, startIndex, items.length]);

    useEffect(() => {
        setPan({ x: 0, y: 0 });
    }, [index]);

    useEffect(() => {
        if (zoom <= 1) {
            setPan({ x: 0, y: 0 });
        }
    }, [zoom]);

    useEffect(() => {
        if (!open) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    useEffect(() => {
        if (!open || !items.length) return undefined;

        const preloadIndexes = new Set([
            index,
            index - 1,
            index - 2,
            index + 1,
            index + 2,
        ]);

        preloadIndexes.forEach((i) => {
            const url = items[i]?.url;
            if (!url) return;
            const img = new Image();
            img.src = url;
        });
    }, [open, index, items]);

    const current = items[index] || null;
    const hasPrev = index > 0;
    const hasNext = index < items.length - 1;
    const canCompareCurrent = Boolean(current?.compare && onCompare);

    const goPrev = useCallback(() => {
        setIndex((prev) => Math.max(prev - 1, 0));
    }, []);

    const goNext = useCallback(() => {
        setIndex((prev) => Math.min(prev + 1, items.length - 1));
    }, [items.length]);

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
        if (!open) return undefined;
        const viewport = viewportRef.current;
        if (!viewport) return undefined;

        viewport.addEventListener('wheel', handleWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', handleWheel);
    }, [open, handleWheel]);

    useEffect(() => {
        if (!open) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
            if (event.key === 'ArrowLeft' && hasPrev) goPrev();
            if (event.key === 'ArrowRight' && hasNext) goNext();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, hasPrev, hasNext, goPrev, goNext, onClose]);

    if (!mounted || !open || !current?.url) return null;

    const zoomPercent = Math.round(zoom * 100);
    const canPan = zoom > 1;

    return createPortal(
        <div
            className="fixed inset-0 z-[200] bg-white/55 backdrop-blur-[2px]"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Assessment photo viewer"
        >
            <div
                className="absolute inset-2 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-md sm:inset-3 lg:left-72 lg:right-3 lg:top-3 lg:bottom-3"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{current.label}</p>
                        <p className="text-xs text-slate-500">
                            {index + 1} of {items.length}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-4">
                    <div
                        ref={viewportRef}
                        className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 select-none ${
                            canPan ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                        }`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                    >
                        <button
                            type="button"
                            onClick={goPrev}
                            disabled={!hasPrev}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="absolute left-3 z-10 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-md transition-all duration-150 hover:scale-105 hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:left-4 sm:p-3"
                            title="Previous photo"
                        >
                            <ChevronLeft size={28} />
                        </button>

                        <div className="flex h-full w-full items-center justify-center p-6 sm:p-8">
                            <div
                                className="animate-in fade-in duration-150"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transformOrigin: 'center center',
                                    transition: isDragging ? 'none' : 'transform 120ms ease-out',
                                }}
                            >
                                <img
                                    key={`${index}-${current.url}`}
                                    src={current.url}
                                    alt={`${current.label} photo`}
                                    className="max-h-[min(70vh,720px)] max-w-full object-contain pointer-events-none"
                                    draggable={false}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!hasNext}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="absolute right-3 z-10 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-md transition-all duration-150 hover:scale-105 hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:right-4 sm:p-3"
                            title="Next photo"
                        >
                            <ChevronRight size={28} />
                        </button>
                    </div>

                    <div className="mt-3 flex shrink-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3 sm:px-5">
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Zoom
                        </span>
                        <input
                            type="range"
                            min={MIN_ZOOM * 100}
                            max={MAX_ZOOM * 100}
                            step={ZOOM_SLIDER_STEP}
                            value={zoomPercent}
                            onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                            aria-label="Zoom level"
                            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-600 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-600"
                        />
                        <span className="min-w-[44px] shrink-0 text-right text-xs font-bold tabular-nums text-slate-800">
                            {zoomPercent}%
                        </span>
                    </div>
                    <p className="mt-1 text-center text-[10px] text-slate-400">
                        Scroll to zoom · drag the image to move when zoomed in
                    </p>
                </div>

                <div className="grid shrink-0 grid-cols-3 items-center gap-3 border-t border-slate-200/80 px-4 py-3 sm:px-6 sm:py-4">
                    <button
                        type="button"
                        onClick={goPrev}
                        disabled={!hasPrev}
                        className="inline-flex items-center justify-self-start gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                    >
                        <ChevronLeft size={16} />
                        Prev
                    </button>
                    {canCompareCurrent ? (
                        <button
                            type="button"
                            onClick={() => onCompare(current)}
                            className={`inline-flex items-center justify-center justify-self-center rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors sm:px-4 sm:text-xs ${
                                current.compare.changed
                                    ? 'border-red-300 bg-white text-red-700 hover:bg-red-50'
                                    : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
                            }`}
                        >
                            Compare to Previous
                        </button>
                    ) : (
                        <span />
                    )}
                    <button
                        type="button"
                        onClick={goNext}
                        disabled={!hasNext}
                        className="inline-flex items-center justify-self-end gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
