'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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

const ActivityPieChart = memo(function ActivityPieChart({
    data,
    mode = 'Pending',
    pendingTotal = 0,
    overdueTotal = 0,
    onModeChange,
}) {
    const reduceMotion = useReducedMotion();
    const total = data?.total || 0;
    const segments = data?.segments || [];
    const isEmpty = total === 0 || segments.length === 0;
    const isOverdueMode = mode === 'Overdue';
    const displayTotal = useCountUp(total);

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

    return (
        <div
            className="flex flex-col items-center justify-center w-full"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 lg:w-48 lg:h-48 shrink-0">
                <svg
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="w-full h-full -rotate-90 transform-gpu"
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
                            strokeWidth={STROKE}
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
                        >
                            {ring.label ? (
                                <title>{`${ring.label}: ${ring.count}`}</title>
                            ) : null}
                        </motion.circle>
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 leading-none tracking-tight tabular-nums">
                        {displayTotal}
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
                        {isOverdueMode ? 'Overdue' : 'Pending'}
                    </span>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3 sm:mt-4 px-1">
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
        </div>
    );
});

export default ActivityPieChart;
