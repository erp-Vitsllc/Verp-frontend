'use client';

import { formatExpiryDurationDisplay } from '@/app/emp/[employeeId]/utils/helpers';

/**
 * Blue fleet summary: registration / insurance / warranty / service expiry countdowns.
 * Only rows with an expiry date on the vehicle are shown.
 */
export default function VehicleExpirySummaryCard({
    registrationExpirySrc,
    insuranceExpirySrc,
    warrantyExpirySrc,
    serviceExpirySrc,
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

    return (
        <div
            className={`w-full h-full rounded-2xl bg-[#00AEEF] p-2.5 shadow-xl transition-all duration-300 ${className}`.trim()}
        >
            <div className="w-full h-full border-2 border-white/50 rounded-xl px-7 py-8 flex flex-col justify-center gap-5">
                {rows.length > 0 ? (
                    rows.map(({ label, value }) => (
                        <div key={label} className="flex items-baseline gap-2.5">
                            <span className="text-[16px] font-black text-white whitespace-nowrap tracking-tight">{label} :</span>
                            <span className="text-[16px] font-black text-white tracking-tight">{value || ''}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-[14px] font-bold text-white/80">No expiry dates on file</p>
                )}
            </div>
        </div>
    );
}
