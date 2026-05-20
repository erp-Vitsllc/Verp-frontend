'use client';

import { useEffect, useState } from 'react';

export function AnimatedCounter({ value, duration = 600 }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime;
        let animationFrame;
        const target = Math.round(Number(value) || 0);

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;

            if (progress < duration) {
                const percentage = progress / duration;
                const easeOut = 1 - Math.pow(1 - percentage, 4);
                setCount(Math.floor(easeOut * target));
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{count}</>;
}

function SummaryMiniCard({ label, value, suffix }) {
    const n = Math.round(Number(value) || 0);
    return (
        <div className="bg-gray-100 p-3 sm:p-4 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center min-h-[88px]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 leading-tight text-center block px-0.5">
                {label}
            </span>
            <div
                className="text-lg sm:text-xl md:text-2xl font-black tabular-nums flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0"
                style={{ color: '#dc2626' }}
            >
                <AnimatedCounter value={n} />
                {suffix ? <span className="text-xs sm:text-sm font-black tracking-tight">{suffix}</span> : null}
            </div>
        </div>
    );
}

export function AssetListSummaryPanels({ leftCards, rightCards }) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {leftCards.map((c, i) => (
                        <SummaryMiniCard key={`l-${i}`} label={c.label} value={c.value} suffix={c.suffix} />
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {rightCards.map((c, i) => (
                        <SummaryMiniCard key={`r-${i}`} label={c.label} value={c.value} suffix={c.suffix} />
                    ))}
                </div>
            </div>
        </div>
    );
}
