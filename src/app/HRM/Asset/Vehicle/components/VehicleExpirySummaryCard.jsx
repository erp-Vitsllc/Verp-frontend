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
    const actionGridClass = 'grid-cols-2';

    return (
        <div
            className={`w-full h-full flex flex-col rounded-xl sm:rounded-2xl bg-[#00AEEF] p-1.5 sm:p-2 shadow-lg transition-all duration-300 ${className}`.trim()}
        >
            <div
                className={`w-full h-full min-h-0 border-2 border-white/50 rounded-lg sm:rounded-xl ${
                    splitLayout
                        ? 'flex flex-row items-stretch gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3'
                        : 'flex flex-col justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3'
                }`}
            >
                {showExpiry ? (
                    <div
                        className={
                            splitLayout
                                ? 'flex flex-col justify-center gap-1.5 sm:gap-2 shrink-0 w-[42%] min-w-[120px] py-0.5'
                                : 'flex flex-col justify-center gap-1.5 sm:gap-2'
                        }
                    >
                        {rows.map(({ label, value, hasDate }) => (
                            <div key={label} className="flex flex-col gap-0 sm:flex-row sm:items-baseline sm:gap-1.5 min-w-0">
                                <span className="text-[11px] sm:text-xs lg:text-[13px] font-black text-white whitespace-nowrap tracking-tight">
                                    {label} :
                                </span>
                                <span
                                    className={`text-[10px] sm:text-[11px] lg:text-xs font-black tracking-tight leading-snug break-words min-w-0 ${
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
                                : 'flex flex-col justify-center min-w-0 w-full'
                        }
                    >
                        <div className={`grid gap-2 w-full ${actionGridClass}`}>
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
                                        `${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8] text-[10px] sm:text-xs ${
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
                    <p className="text-[11px] sm:text-xs font-bold text-white/80 text-center px-3">
                        No fleet actions available for this vehicle.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
