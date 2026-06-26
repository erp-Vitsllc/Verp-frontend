'use client';

import { formatExpiryDurationDisplay } from '@/app/emp/[employeeId]/utils/helpers';
import { ACTION_BTN_BASE } from '../utils/evaluateVehicleFleetHeaderActions';

/**
 * Blue fleet summary: expiry countdowns on the left, assignment actions on the right
 * (same side-by-side layout as the tools asset blue panel).
 */
export default function VehicleExpirySummaryCard({
    registrationExpirySrc,
    insuranceExpirySrc,
    warrantyExpirySrc,
    serviceExpirySrc,
    actionButtons = [],
    className = '',
}) {
    const rows = [
        { label: 'Registration Expiry', date: registrationExpirySrc },
        { label: 'Insurance Expiry', date: insuranceExpirySrc },
        { label: 'Warranty Expiry', date: warrantyExpirySrc },
        { label: 'Service Expiry', date: serviceExpirySrc },
    ]
        .filter(({ date }) => date != null && String(date).trim() !== '')
        .map(({ label, date }) => ({
            label,
            value: formatExpiryDurationDisplay(date),
        }));

    const hasActions = actionButtons.length > 0;

    return (
        <div
            className={`w-full h-full rounded-2xl bg-[#00AEEF] p-2.5 shadow-xl transition-all duration-300 ${className}`.trim()}
        >
            <div
                className={`w-full h-full border-2 border-white/50 rounded-xl ${
                    hasActions
                        ? 'flex flex-row items-stretch gap-4 sm:gap-5 px-5 py-5'
                        : 'flex flex-col justify-center gap-5 px-7 py-8'
                }`}
            >
                <div
                    className={
                        hasActions
                            ? 'flex flex-col justify-center gap-4 sm:gap-5 shrink-0 w-[42%] min-w-[140px] py-1'
                            : 'flex flex-col justify-center gap-5'
                    }
                >
                    {rows.length > 0 ? (
                        rows.map(({ label, value }) => (
                            <div key={label} className="flex items-baseline gap-2.5">
                                <span className="text-[15px] sm:text-[16px] font-black text-white whitespace-nowrap tracking-tight">
                                    {label} :
                                </span>
                                <span className="text-[15px] sm:text-[16px] font-black text-white tracking-tight">
                                    {value || ''}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-[14px] font-bold text-white/80">No expiry dates on file</p>
                    )}
                </div>

                {hasActions ? (
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div
                            className={`grid gap-3 w-full ${
                                actionButtons.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                            }`}
                        >
                            {actionButtons.map((action) => (
                                <button
                                    key={action.key || action.label}
                                    type="button"
                                    disabled={action.disabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!action.disabled) action.onClick?.();
                                    }}
                                    className={
                                        action.className ||
                                        `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] ${
                                            action.disabled ? 'opacity-50 cursor-not-allowed' : ''
                                        }`
                                    }
                                    title={action.title || action.disabledReason || undefined}
                                >
                                    {action.displayLabel || action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
