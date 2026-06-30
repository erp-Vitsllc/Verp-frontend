'use client';

export default function VehicleHandoverYesNoToggle({ value, onChange, disabled = false, size = 'sm' }) {
    const padClass = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';

    const handleSelect = (nextValue, event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled || value === nextValue) return;
        onChange(nextValue);
    };

    return (
        <div
            className={`inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5 ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
            }`}
            onClick={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                disabled={disabled}
                onClick={(event) => handleSelect(true, event)}
                className={`rounded-md font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed ${padClass} ${
                    value === true
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : disabled
                          ? 'text-gray-400'
                          : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Yes
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={(event) => handleSelect(false, event)}
                className={`rounded-md font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed ${padClass} ${
                    value === false
                        ? 'bg-slate-600 text-white shadow-sm'
                        : disabled
                          ? 'text-gray-400'
                          : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                No
            </button>
        </div>
    );
}
