'use client';

import { Calendar } from 'lucide-react';
import { FineFormCard, formatMoney } from './FineFormCardShared';

function MonthBox({ box, variant }) {
    const showDetail =
        box.detailAmount != null && box.detailAmount > 0 && box.isThisFineMonth;

    return (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex flex-col items-center text-center min-h-[110px] hover:border-blue-200 hover:shadow-sm transition-all">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {box.label}
            </p>
            <p className="text-xl font-bold text-red-600">{formatMoney(box.total)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">AED</p>
            {box.sourceLabel ? (
                <span className="mt-2 inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    {box.sourceLabel}
                </span>
            ) : null}
            {showDetail ? (
                <p className="mt-1 text-xs font-semibold text-gray-600">
                    {formatMoney(box.detailAmount)}
                    {variant === 'new' ? ' AED' : ''}
                </p>
            ) : null}
        </div>
    );
}

export default function DeductionScheduleBoxes({ title, subtitle, boxes, variant = 'current' }) {
    if (!boxes?.length) return null;

    return (
        <FineFormCard
            icon={Calendar}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            title={title}
            subtitle={subtitle}
        >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {boxes.map((box) => (
                    <MonthBox key={box.ym} box={box} variant={variant} />
                ))}
            </div>
        </FineFormCard>
    );
}
