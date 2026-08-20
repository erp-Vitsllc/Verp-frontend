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

    return <>{count.toLocaleString('en-US')}</>;
}

function valueFontSize(n, hasSuffix) {
    const digits = String(Math.abs(Math.round(Number(n) || 0))).length;
    if (hasSuffix || digits >= 7) return 'clamp(0.75rem, 1.6vw, 1.05rem)';
    if (digits >= 5) return 'clamp(0.9rem, 1.9vw, 1.25rem)';
    return 'clamp(1.05rem, 2.2vw, 1.5rem)';
}

function SummaryMiniCard({ label, value, suffix, onClick, isActive, empty, href, fillHeight = true }) {
    const tileSize = fillHeight
        ? 'h-full min-h-[56px] sm:min-h-[64px] p-2 sm:p-2.5'
        : 'min-h-[56px] sm:min-h-[64px] p-2 sm:p-2.5';

    if (empty) {
        return (
            <div
                className={`rounded-lg border border-dashed border-gray-200 bg-gray-50/80 min-w-0 w-full ${tileSize}`}
                aria-hidden="true"
            />
        );
    }

    const n = Math.round(Number(value) || 0);
    const hasSuffix = Boolean(suffix);
    const sharedClass = `min-w-0 w-full rounded-lg border flex flex-col items-center justify-center text-center ${tileSize} overflow-hidden transition-all ${
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
            <span className="text-[8px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5 leading-tight text-center block w-full px-0.5 break-words hyphens-auto">
                {label}
            </span>
            <div
                className="w-full min-w-0 flex flex-col items-center justify-center gap-y-0.5"
                style={{ color: '#dc2626' }}
            >
                <span
                    className="font-black tabular-nums leading-none whitespace-nowrap max-w-full"
                    style={{ fontSize: valueFontSize(n, hasSuffix) }}
                >
                    <AnimatedCounter value={n} />
                </span>
                {hasSuffix ? (
                    <span className="text-[9px] sm:text-[10px] font-black tracking-tight leading-none">
                        {suffix}
                    </span>
                ) : null}
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

export function AssetListSummaryPanels({ leftCards, rightCards, onCardClick, isCardActive, compact = false }) {
    const renderCard = (c, i, prefix) => (
        <SummaryMiniCard
            key={`${prefix}-${c.filterKey || i}`}
            label={c.label}
            value={c.value}
            suffix={c.suffix}
            empty={c.empty}
            href={c.href}
            fillHeight={!compact}
            onClick={c.filterKey && onCardClick ? () => onCardClick(c.filterKey) : undefined}
            isActive={c.filterKey && isCardActive ? isCardActive(c.filterKey) : false}
        />
    );

    const padClass = compact ? 'p-3 sm:p-4' : 'p-3 sm:p-4 lg:p-5';

    if (compact) {
        return (
            <div className="grid w-full max-w-full grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 items-start">
                <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padClass} h-fit self-start`}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full">
                        {leftCards.map((c, i) => renderCard(c, i, 'l'))}
                    </div>
                </div>
                <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padClass} h-fit self-start`}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full">
                        {rightCards.map((c, i) => renderCard(c, i, 'r'))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${HEADER_PAIR_GRID} xl:grid-cols-2`}>
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padClass} ${HEADER_PAIR_CARD_DASHBOARD}`}>
                <div className={summaryGridClass}>
                    {leftCards.map((c, i) => renderCard(c, i, 'l'))}
                </div>
            </div>
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padClass} ${HEADER_PAIR_CARD_DASHBOARD}`}>
                <div className={summaryGridClass}>
                    {rightCards.map((c, i) => renderCard(c, i, 'r'))}
                </div>
            </div>
        </div>
    );
}
