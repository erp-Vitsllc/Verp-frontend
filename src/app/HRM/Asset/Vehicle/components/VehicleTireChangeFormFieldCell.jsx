'use client';

export default function VehicleTireChangeFormFieldCell({ label, children, accentClass, minHeightPx, className = '' }) {
    return (
        <div
            className={`flex flex-col justify-center rounded-lg border px-3 py-2.5 ${accentClass} ${className}`.trim()}
            style={{ minHeight: `${minHeightPx}px` }}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
            <div className="mt-1.5 min-w-0">{children}</div>
        </div>
    );
}
