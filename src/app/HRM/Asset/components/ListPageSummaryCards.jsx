'use client';

import { useEffect, useState } from 'react';
import { HEADER_PAIR_CARD_DASHBOARD, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';
import { navHrefProps } from '@/utils/linkContextMenu';

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

function SummaryMiniCard({ label, value, suffix, onClick, isActive, empty, href }) {
    if (empty) {
        return (
            <div
                className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 h-full min-h-[56px] sm:min-h-[64px] p-2 sm:p-3"
                aria-hidden="true"
            />
        );
    }

    const n = Math.round(Number(value) || 0);
    const sharedClass = `rounded-lg border flex flex-col items-center justify-center text-center h-full min-h-[56px] sm:min-h-[64px] p-2 sm:p-3 overflow-hidden transition-all ${
        isActive
            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200 shadow-sm'
            : 'bg-gray-100 border-gray-100'
    } ${
        onClick
            ? 'cursor-pointer hover:bg-white hover:shadow-md hover:border-gray-200 hover:scale-[1.02] active:scale-[0.98]'
            : ''
    }`;

    const content = (
        <>
            <span className="text-[8px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5 sm:mb-1 leading-tight text-center block w-full px-0.5 break-words hyphens-auto">
                {label}
            </span>
            <div
                className="text-lg sm:text-xl lg:text-2xl font-black tabular-nums flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0 leading-none"
                style={{ color: '#dc2626' }}
            >
                <AnimatedCounter value={n} />
                {suffix ? <span className="text-[10px] sm:text-xs font-black tracking-tight">{suffix}</span> : null}
            </div>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={sharedClass}
                title={`Filter: ${label}`}
                {...navHrefProps(href || '')}
            >
                {content}
            </button>
        );
    }

    return <div className={sharedClass}>{content}</div>;
}

const summaryGridClass =
    'grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 w-full auto-rows-fr';

export function AssetListSummaryPanels({ leftCards, rightCards, onCardClick, isCardActive }) {
    const renderCard = (c, i, prefix) => (
        <SummaryMiniCard
            key={`${prefix}-${c.filterKey || i}`}
            label={c.label}
            value={c.value}
            suffix={c.suffix}
            empty={c.empty}
            href={c.href}
            onClick={c.filterKey && onCardClick ? () => onCardClick(c.filterKey) : undefined}
            isActive={c.filterKey && isCardActive ? isCardActive(c.filterKey) : false}
        />
    );

    return (
        <div className={`${HEADER_PAIR_GRID} xl:grid-cols-2`}>
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-5 flex flex-col ${HEADER_PAIR_CARD_DASHBOARD}`}>
                <div className={summaryGridClass}>
                    {leftCards.map((c, i) => renderCard(c, i, 'l'))}
                </div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-5 flex flex-col ${HEADER_PAIR_CARD_DASHBOARD}`}>
                <div className={summaryGridClass}>
                    {rightCards.map((c, i) => renderCard(c, i, 'r'))}
                </div>
            </div>
        </div>
    );
}
