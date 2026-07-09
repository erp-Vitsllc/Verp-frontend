'use client';

import { ACTION_BTN_BASE } from '../utils/evaluateVehicleFleetHeaderActions';
import { formatVehicleExpiryCountdown } from '../utils/vehicleExpirySources';

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
    showExpirySummary = true,
    actionsAtTop = false,
    className = '',
}) {
    const rows = [
        { label: 'Registration Expiry', date: registrationExpirySrc },
        { label: 'Insurance Expiry', date: insuranceExpirySrc },
        { label: 'Warranty Expiry', date: warrantyExpirySrc },
        { label: 'Service Expiry', date: serviceExpirySrc },
    ].map(({ label, date }) => ({
        label,
        value: formatVehicleExpiryCountdown(date),
        hasDate: date != null && String(date).trim() !== '',
    }));

    const hasActions = actionButtons.length > 0;
    const showExpiry = showExpirySummary !== false;
    const splitLayout = showExpiry && hasActions;
    const actionsOnlyAtTop = actionsAtTop && hasActions && !showExpiry;
    const actionGridClass = 'grid-cols-2';

    return (
        <div
            className={`w-full h-full rounded-2xl bg-[#00AEEF] p-2.5 shadow-xl transition-all duration-300 ${className}`.trim()}
        >
            <div
                className={`w-full h-full border-2 border-white/50 rounded-xl ${
                    splitLayout
                        ? 'flex flex-row items-stretch gap-4 sm:gap-5 px-5 py-5'
                        : hasActions
                          ? actionsOnlyAtTop
                              ? 'flex flex-col justify-start px-5 pt-4 pb-5'
                              : 'flex flex-col justify-center px-5 py-5'
                          : 'flex flex-col justify-center gap-5 px-7 py-8'
                }`}
            >
                {showExpiry ? (
                    <div
                        className={
                            splitLayout
                                ? 'flex flex-col justify-center gap-4 sm:gap-5 shrink-0 w-[42%] min-w-[140px] py-1'
                                : 'flex flex-col justify-center gap-5'
                        }
                    >
                        {rows.map(({ label, value, hasDate }) => (
                            <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
                                <span className="text-[15px] sm:text-[16px] font-black text-white whitespace-nowrap tracking-tight">
                                    {label} :
                                </span>
                                <span
                                    className={`text-[14px] sm:text-[15px] font-black tracking-tight leading-snug ${
                                        hasDate ? 'text-white' : 'text-white/70'
                                    }`}
                                >
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {hasActions ? (
                    <div
                        className={
                            splitLayout
                                ? 'flex-1 flex flex-col justify-center min-w-0'
                                : actionsOnlyAtTop
                                  ? 'flex flex-col justify-start min-w-0 w-full'
                                  : 'flex flex-col justify-center min-w-0 w-full'
                        }
                    >
                        <div className={`grid gap-3 w-full ${actionGridClass}`}>
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

                {!showExpiry && !hasActions ? (
                    <p className="text-[14px] font-bold text-white/80 text-center px-4">
                        No fleet actions available for this vehicle.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
