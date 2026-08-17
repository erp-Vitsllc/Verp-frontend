'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { DASH_EASE } from './dashboardMotion';

const SIZE = 160;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;
const SEGMENT_GAP = 7;

function useCountUp(target, duration = 780) {
    const reduceMotion = useReducedMotion();
    const [value, setValue] = useState(() => (reduceMotion ? target : 0));

    useEffect(() => {
        if (reduceMotion) {
            setValue(target);
            return undefined;
        }

        const start = performance.now();
        let frame;

        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - (1 - progress) ** 3;
            setValue(Math.round(target * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, duration, reduceMotion]);

    return value;
}

function SliceHoverTooltip({ hovered, mode, total, reduceMotion }) {
    if (!hovered || typeof document === 'undefined') return null;

    const percent = total > 0 ? Math.round((Number(hovered.count) / total) * 100) : 0;
    const pad = 18;
    const estimatedWidth = 260;
    const estimatedHeight = 150;
    const left = Math.min(
        Math.max(12, hovered.x + pad),
        Math.max(12, window.innerWidth - estimatedWidth - 12),
    );
    const top = Math.min(
        Math.max(12, hovered.y - estimatedHeight - 8),
        Math.max(12, window.innerHeight - estimatedHeight - 12),
    );

    return createPortal(
        <AnimatePresence>
            <motion.div
                key={`${hovered.label}-${mode}`}
                initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: DASH_EASE }}
                className="pointer-events-none fixed z-[120]"
                style={{ left, top }}
            >
                <div
                    className="min-w-[220px] max-w-[280px] rounded-3xl border border-white/15 px-5 py-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.38)] backdrop-blur-md"
                    style={{
                        background: 'linear-gradient(180deg, rgba(15,23,42,0.97), rgba(15,23,42,0.9))',
                        boxShadow: `0 18px 44px ${hovered.color}55, 0 24px 60px rgba(15,23,42,0.38)`,
                    }}
                >
                    <div
                        className="h-1.5 w-full rounded-full mb-3"
                        style={{ background: `linear-gradient(90deg, ${hovered.color}, ${hovered.color}66)` }}
                    />
                    <div className="flex items-center gap-2.5 mb-2">
                        <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 ring-4 ring-white/15"
                            style={{ backgroundColor: hovered.color }}
                        />
                        <span className="text-base font-black tracking-tight leading-tight">
                            {hovered.label}
                        </span>
                    </div>
                    <div className="flex items-end gap-2.5">
                        <span className="text-4xl font-black tabular-nums leading-none tracking-tight">
                            {hovered.count}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300 pb-1">
                            {mode}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="px-2 py-1 rounded-full bg-white/10 text-[11px] font-black tabular-nums tracking-wide">
                            {percent}% of {mode.toLowerCase()}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Click to open
                        </span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}

const ActivityPieChart = memo(function ActivityPieChart({
    data,
    mode = 'Pending',
    pendingTotal = 0,
    overdueTotal = 0,
    onModeChange,
    onSliceClick,
    onCenterClick,
}) {
    const reduceMotion = useReducedMotion();
    const total = data?.total || 0;
    const segments = data?.segments || [];
    const isEmpty = total === 0 || segments.length === 0;
    const isOverdueMode = mode === 'Overdue';
    const displayTotal = useCountUp(total);
    const [hovered, setHovered] = useState(null);

    const rings = useMemo(() => {
        if (isEmpty) {
            return [{ key: 'empty', color: '#e2e8f0', length: CIRCUMFERENCE, offset: 0 }];
        }

        const gap = segments.length > 1 ? SEGMENT_GAP : 0;
        let offset = 0;

        return segments.map((segment, index) => {
            const raw = (Number(segment.count) / total) * CIRCUMFERENCE;
            const length = Math.max(0, raw - gap);
            const ring = {
                key: `${segment.label}-${index}`,
                color: segment.color,
                label: segment.label,
                count: segment.count,
                length,
                offset,
            };
            offset += raw;
            return ring;
        });
    }, [isEmpty, segments, total]);

    const selectMode = (nextMode) => (event) => {
        event.stopPropagation();
        onModeChange?.(nextMode);
    };

    const selectSlice = (label) => (event) => {
        event.stopPropagation();
        if (!label) return;
        onSliceClick?.(label);
    };

    const selectCenter = (event) => {
        event.stopPropagation();
        onCenterClick?.();
    };

    const showHover = (event, segment) => {
        if (!segment?.label) return;
        setHovered({
            label: segment.label,
            count: segment.count,
            color: segment.color,
            x: event.clientX,
            y: event.clientY,
        });
    };

    return (
        <div
            className="flex flex-col items-center justify-center w-full max-w-full min-w-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="relative mx-auto w-[min(100%,10rem)] sm:w-[min(100%,11rem)] aspect-square shrink-0 overflow-visible">
                <svg
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="w-full h-full -rotate-90 transform-gpu overflow-visible"
                    overflow="visible"
                    aria-hidden="true"
                >
                    <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth={STROKE}
                    />
                    {rings.map((ring, index) => (
                        <motion.circle
                            key={`${mode}-${ring.key}`}
                            cx={CENTER}
                            cy={CENTER}
                            r={RADIUS}
                            fill="none"
                            stroke={ring.color}
                            strokeWidth={hovered?.label === ring.label ? STROKE + 3 : STROKE}
                            strokeLinecap={isEmpty ? 'butt' : 'round'}
                            strokeDasharray={`${ring.length} ${CIRCUMFERENCE}`}
                            initial={
                                reduceMotion
                                    ? false
                                    : { strokeDasharray: `0 ${CIRCUMFERENCE}`, strokeDashoffset: -ring.offset }
                            }
                            animate={{
                                strokeDasharray: `${ring.length} ${CIRCUMFERENCE}`,
                                strokeDashoffset: -ring.offset,
                            }}
                            transition={{
                                duration: reduceMotion ? 0 : 0.85,
                                delay: reduceMotion ? 0 : 0.12 + index * 0.08,
                                ease: DASH_EASE,
                            }}
                            style={{ transformOrigin: 'center' }}
                            className="pointer-events-none"
                        />
                    ))}
                    {rings.map((ring) =>
                        ring.label ? (
                            <circle
                                key={`hit-${mode}-${ring.key}`}
                                cx={CENTER}
                                cy={CENTER}
                                r={RADIUS}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={STROKE + 16}
                                strokeLinecap="round"
                                strokeDasharray={`${ring.length} ${CIRCUMFERENCE}`}
                                strokeDashoffset={-ring.offset}
                                pointerEvents="stroke"
                                className="cursor-pointer"
                                onMouseEnter={(event) => showHover(event, ring)}
                                onMouseMove={(event) => showHover(event, ring)}
                                onMouseLeave={() => setHovered(null)}
                                onClick={selectSlice(ring.label)}
                            />
                        ) : null,
                    )}
                </svg>
                <button
                    type="button"
                    onClick={selectCenter}
                    className="absolute inset-[22%] sm:inset-[24%] rounded-full z-10 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50/90 transition-colors"
                    title="Open activity log"
                >
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 leading-none tracking-tight tabular-nums">
                        {hovered ? hovered.count : displayTotal}
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1 max-w-[4.5rem] text-center leading-tight">
                        {hovered ? hovered.label : isOverdueMode ? 'Overdue' : 'Pending'}
                    </span>
                </button>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 sm:mt-3 px-1 w-full">
                <button
                    type="button"
                    onClick={selectMode('Pending')}
                    className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md transition-colors duration-200 ${
                        !isOverdueMode ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-slate-50'
                    }`}
                >
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 shrink-0"></div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Pending {pendingTotal}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={selectMode('Overdue')}
                    className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md transition-colors duration-200 ${
                        isOverdueMode ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'
                    }`}
                >
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-orange-500 shrink-0"></div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Overdue {overdueTotal}
                    </span>
                </button>
            </div>
            {!isEmpty ? (
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5 px-1 w-full">
                    {segments.map((segment) => (
                        <button
                            key={segment.label}
                            type="button"
                            onClick={selectSlice(segment.label)}
                            onMouseEnter={(event) => showHover(event, segment)}
                            onMouseMove={(event) => showHover(event, segment)}
                            onMouseLeave={() => setHovered(null)}
                            className="flex items-center gap-1 px-1 py-0.5 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            <div
                                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
                                style={{ backgroundColor: segment.color }}
                            />
                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                {segment.label}
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}
            <SliceHoverTooltip
                hovered={hovered}
                mode={isOverdueMode ? 'Overdue' : 'Pending'}
                total={total}
                reduceMotion={reduceMotion}
            />
        </div>
    );
});

export default ActivityPieChart;
