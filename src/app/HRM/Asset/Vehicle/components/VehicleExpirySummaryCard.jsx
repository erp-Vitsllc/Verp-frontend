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
            className={`w-full h-full rounded-2xl bg-[#00AEEF] p-2.5 shadow-xl transition-all duration-300 ${className}`.trim()}
        >
            <div className="w-full h-full border-2 border-white/50 rounded-xl px-7 py-8 flex flex-col justify-center gap-5">
                {rows.map(({ label, value }) => (
                    <div key={label} className="flex items-baseline gap-2.5">
                        <span className="text-[16px] font-black text-white whitespace-nowrap tracking-tight">{label} :</span>
                        <span className="text-[16px] font-black text-white tracking-tight">{value || ''}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
