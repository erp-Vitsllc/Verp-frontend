'use client';

function formatExpiryDisplay(date) {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '';
    }
}

/**
 * Blue fleet summary: registration / insurance / warranty / next service expiry in one narrow column.
 */
export default function VehicleExpirySummaryCard({
    registrationExpirySrc,
    insuranceExpirySrc,
    warrantyExpirySrc,
    serviceExpirySrc,
    className = '',
}) {
    const rows = [
        { label: 'Registration Expiry', value: formatExpiryDisplay(registrationExpirySrc) },
        { label: 'Insurance Expiry', value: formatExpiryDisplay(insuranceExpirySrc) },
        { label: 'Warranty Expiry', value: formatExpiryDisplay(warrantyExpirySrc) },
        { label: 'Service Expiry', value: formatExpiryDisplay(serviceExpirySrc) },
    ];

    return (
        <div
            className={`w-full h-full rounded-2xl bg-blue-600 p-6 shadow-md ring-2 ring-white/90 ring-inset sm:p-7 ${className}`.trim()}
        >
            <ul className="flex flex-col gap-4 font-sans">
                {rows.map(({ label, value }) => (
                    <li key={label}>
                        <p className="text-[13px] sm:text-sm font-bold text-white leading-snug tracking-tight">
                            <span className="tabular-nums">{label}:</span>
                            <span className="ml-2 font-bold text-white/95">{value || '—'}</span>
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
