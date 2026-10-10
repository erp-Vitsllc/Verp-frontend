'use client';

export { isNextDayCheckout } from './nextDayCheckout.logic.mjs';

export function NextDayCheckoutTime({
    time,
    nextDay = false,
    className = '',
    colorClass = 'text-[#DC2626]',
}) {
    const label = !time || time === '—' ? '—' : time;
    if (!nextDay || label === '—') {
        return <span className={className}>{label}</span>;
    }
    return (
        <span className={`font-semibold ${colorClass} ${className}`}>
            {label} (next day)
        </span>
    );
}
