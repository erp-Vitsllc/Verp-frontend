'use client';

import VehiclePlateThumbnail from '@/app/HRM/Asset/Vehicle/components/VehiclePlateThumbnail';

function formatHdrDate(date) {
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

function truncate(str, max) {
    const s = String(str || '').trim();
    if (!s) return '';
    return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/**
 * Fleet vehicle summary card: photo placeholder, title block, expiry rows, plate graphic, profile completion bar.
 */
export default function VehicleAssetProfileHeader({
    asset,
    registrationExpirySrc,
    insuranceExpirySrc,
    warrantyExpirySrc,
    insuranceProviderLabel,
    warrantyKmLabel,
    permitHint,
    className = '',
}) {
    const name = truncate(asset?.name || 'Vehicle', 80);
    const subParts = [asset?.typeId?.name || asset?.type, asset?.vehicleCode, asset?.modelYear].filter(
        (x) => x && String(x).trim()
    );
    const subtitle = subParts.join(', ');

    const regExpiry = registrationExpirySrc ? formatHdrDate(registrationExpirySrc) : '';
    const insExpiry = insuranceExpirySrc ? formatHdrDate(insuranceExpirySrc) : '';
    const warExpiry = warrantyExpirySrc ? formatHdrDate(warrantyExpirySrc) : '';
    const purchase = asset?.purchaseDate ? formatHdrDate(asset.purchaseDate) : '';
    const serviceDue = asset?.nextServiceDate ? formatHdrDate(asset.nextServiceDate) : '';

    const insBy = truncate(insuranceProviderLabel, 56);

    const warrantyLineParts = [];
    if (warExpiry) warrantyLineParts.push(warExpiry);
    const km = warrantyKmLabel ? String(warrantyKmLabel).trim() : '';
    if (km) warrantyLineParts.push(`${Number(km) ? `${Number(km).toLocaleString()} KM` : km}`);

    const rows = [
        insBy ? `Insurance by: ${insBy}${insExpiry ? ` · Expires ${insExpiry}` : ''}` : insExpiry ? `Insurance expiry: ${insExpiry}` : null,
        purchase ? `Purchase date: ${purchase}` : null,
        warrantyLineParts.length ? `Warranty: ${warrantyLineParts.join(' — ')}` : null,
        regExpiry ? `Registration expiry: ${regExpiry}` : null,
        serviceDue ? `Service due: ${serviceDue}` : null,
        permitHint ? `Permit: ${permitHint}` : null,
    ].filter(Boolean);

    const photoSrc = asset?.imagePreview || asset?.photo || asset?.images?.[0]?.url || '';

    const checks = [
        Boolean(photoSrc),
        Boolean(asset?.plateNumber?.trim()),
        Boolean(regExpiry),
        Boolean(insExpiry || insBy),
        Boolean(warExpiry || km),
        Boolean(serviceDue),
    ];
    const profilePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return (
        <div
            className={`w-full rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 overflow-hidden ring-1 ring-slate-950/[0.03] ${className}`}
        >
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5">
                <div className="shrink-0 mx-auto sm:mx-0">
                    {photoSrc ? (
                        <div className="w-[104px] h-[104px] rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                            <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-[104px] h-[104px] rounded-xl border border-slate-200 bg-slate-200/80 flex items-center justify-center">
                            <span className="text-[11px] font-bold text-red-600 tracking-tight text-center px-1 leading-tight">
                                CAR Photo
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-1 pt-0 sm:pr-[min(168px,32%)]">
                    <div className="sm:hidden flex justify-end -mt-1 mb-1">
                        {asset?.plateNumber?.trim() ? (
                            <VehiclePlateThumbnail plateEmirate={asset.plateEmirate} plateNumber={asset.plateNumber} />
                        ) : (
                            <div className="h-[44px] w-[132px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center px-2 text-center">
                                Plate not set
                            </div>
                        )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">{name}</h2>
                    {subtitle ? <p className="text-sm sm:text-[15px] font-bold text-slate-800 leading-snug">{subtitle}</p> : null}

                    <div className="mt-2 space-y-1 text-[13px] text-slate-700 leading-snug">
                        {rows.length ? (
                            rows.map((line, idx) => (
                                <p key={`${idx}-${line.slice(0, 48)}`}>{line}</p>
                            ))
                        ) : (
                            <p className="text-slate-400 italic">No document dates captured yet.</p>
                        )}
                    </div>
                </div>

                <div className="hidden sm:flex flex-col items-end shrink-0 pt-1">
                    {asset?.plateNumber?.trim() ? (
                        <VehiclePlateThumbnail plateEmirate={asset.plateEmirate} plateNumber={asset.plateNumber} />
                    ) : (
                        <div className="h-[48px] w-[148px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-center">
                            Plate not set
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/60 px-4 sm:px-5 py-3">
                <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-slate-700 mb-2">
                    <span>Profile Status</span>
                    <span>{profilePct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${profilePct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
