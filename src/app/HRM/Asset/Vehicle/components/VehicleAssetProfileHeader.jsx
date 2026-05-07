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

    const mortgageBy = truncate(
        asset?.mortgageBy ||
            asset?.mortgageBank ||
            asset?.bankName ||
            asset?.financedBy ||
            '',
        56,
    );
    const assigneeName = (() => {
        const a = asset?.assignedTo;
        if (a && typeof a === 'object') {
            const n = `${a.firstName || ''} ${a.lastName || ''}`.trim();
            return n || a.employeeId || '';
        }
        return '';
    })();
    const serviceDays = (() => {
        if (!asset?.nextServiceDate) return '';
        const t = new Date(asset.nextServiceDate);
        if (Number.isNaN(t.getTime())) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        t.setHours(0, 0, 0, 0);
        const diff = Math.ceil((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return String(Math.max(diff, 0));
    })();

    const rows = [
        { label: 'Insurance by', value: insBy || '-' },
        { label: 'Mortgage By', value: mortgageBy || '-' },
        { label: 'Purchase Date', value: purchase || '-' },
        { label: 'Warranty', value: warrantyLineParts.length ? warrantyLineParts.join(' - ') : '-' },
        {
            label: 'Service',
            value:
                assigneeName && serviceDays
                    ? `${assigneeName} - ${serviceDays} Days`
                    : serviceDue
                      ? `Due ${serviceDue}`
                      : (permitHint || '-'),
        },
    ];

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
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
                <div className="shrink-0 mx-auto sm:mx-0">
                    {photoSrc ? (
                        <div className="w-[180px] h-[150px] rounded-sm border border-slate-300 overflow-hidden bg-slate-100">
                            <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-[180px] h-[150px] rounded-sm border border-slate-300 bg-[#A6A6A6] flex items-center justify-center">
                            <span className="text-[18px] font-black text-[#FF3B30] tracking-tight text-center px-2 leading-tight uppercase">
                                CAR Photo
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0">
                    <div className="sm:hidden flex justify-end -mt-1 mb-1">
                        {asset?.plateNumber?.trim() ? (
                            <VehiclePlateThumbnail size="large" plateEmirate={asset.plateEmirate} plateNumber={asset.plateNumber} />
                        ) : (
                            <div className="h-[44px] w-[132px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center px-2 text-center">
                                Plate not set
                            </div>
                        )}
                    </div>

                    <h2 className="text-[20px] font-bold text-black tracking-tight leading-tight mb-1">{name}</h2>
                    {subtitle ? <p className="text-[18px] font-bold text-black leading-tight mb-2">{subtitle}</p> : null}

                    <div className="space-y-1.5 text-[15px] text-black leading-tight">
                        {rows.map((row) => (
                            <p key={row.label} className="font-bold">
                                {row.label} : {row.value}
                            </p>
                        ))}
                        <p className="font-bold">
                            {assigneeName && serviceDays
                                ? `${assigneeName} - ${serviceDays} Days`
                                : serviceDue
                                    ? `Due ${serviceDue}`
                                    : (permitHint || '-')}
                        </p>
                    </div>
                </div>

                <div className="hidden sm:flex flex-col items-end shrink-0 pt-1">
                    {asset?.plateNumber?.trim() ? (
                        <VehiclePlateThumbnail size="large" plateEmirate={asset.plateEmirate} plateNumber={asset.plateNumber} />
                    ) : (
                        <div className="h-[48px] w-[148px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-center">
                            Plate not set
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 sm:px-6 py-2">
                <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-slate-500 mb-1">
                    <span>Profile Status</span>
                    <span>{profilePct}%</span>
                </div>
            </div>
            <div className="h-[12px] w-full bg-slate-200">
                <div
                    className="h-full bg-[#1E6BFA] transition-all duration-300"
                    style={{ width: `${profilePct}%` }}
                />
            </div>
        </div>
    );
}
