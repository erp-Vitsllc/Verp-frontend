'use client';

import { useMemo } from 'react';
import { FileWarning, Paperclip } from 'lucide-react';
import {
    buildAssetLossFineCardFields,
    isLossDamageFineType,
} from './LossDamageFineDetailsSection';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    SectionDivider,
    formatDeductionMonth,
    formatMoney,
} from './FineFormCardShared';

function resolveIsVehicleAsset(fine, assetDetails) {
    const typeLower = String(assetDetails?.type || assetDetails?.typeId?.name || '').toLowerCase();
    const catLower = String(assetDetails?.category || assetDetails?.categoryId?.name || '').toLowerCase();
    if (typeLower.includes('vehicle') || catLower.includes('vehicle')) return true;
    if (assetDetails?.plateNumber || fine?.vehicleId) return true;
    const fineType = String(fine?.fineType || '').toLowerCase();
    return fineType.includes('vehicle');
}

function resolveFineAttachments(fine) {
    if (Array.isArray(fine?.attachments) && fine.attachments.length > 0) {
        return fine.attachments.filter((item) => item?.url || item?.name);
    }
    if (fine?.attachment?.url || fine?.attachment?.name) {
        return [fine.attachment];
    }
    return [];
}

function formatPayableDuration(duration) {
    const months = parseInt(duration, 10);
    if (!months || months < 1) return '—';
    return `${months} ${months === 1 ? 'month' : 'months'}`;
}

function FineAttachmentList({ fine }) {
    const items = resolveFineAttachments(fine);
    if (!items.length) {
        return <DetailField label="Attachment" value="—" />;
    }

    return (
        <div className="col-span-full">
            <span className="text-xs text-gray-400 block font-medium mb-2">Attachment</span>
            <div className="flex flex-wrap gap-2">
                {items.map((item, index) => {
                    const key = item.publicId || item.url || item.name || index;
                    const label = item.name || `Attachment ${index + 1}`;
                    const isImage = String(item.mimeType || '').startsWith('image/');
                    if (item.url) {
                        return (
                            <a
                                key={key}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-gray-100 transition-colors"
                            >
                                {isImage ? (
                                    <img
                                        src={item.url}
                                        alt={label}
                                        className="h-8 w-8 rounded object-cover"
                                    />
                                ) : (
                                    <Paperclip size={14} className="text-gray-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[160px]">{label}</span>
                            </a>
                        );
                    }
                    return (
                        <span
                            key={key}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700"
                        >
                            <Paperclip size={14} className="text-gray-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{label}</span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

function buildVehicleDetailFields(fine, assetDetails, formatDate) {
    if (!fine && !assetDetails) return null;
    const fmt = formatDate || ((d) => (d ? new Date(d).toLocaleDateString() : '—'));
    const a = assetDetails || {};
    const plate = a.plateNumber || fine?.vehiclePlate || fine?.plateNumber || '';
    const name = a.name || fine?.assetName || fine?.vehicleName || '';
    const assetId = a.assetId || fine?.assetId || fine?.vehicleId || '';
    const hasAny =
        plate ||
        name ||
        assetId ||
        a.manufacture ||
        a.vehicleBrand ||
        a.model ||
        a.modelYear ||
        a.chassisNumber ||
        a.status;

    if (!hasAny && !resolveIsVehicleAsset(fine, assetDetails)) return null;

    return {
        assetId: assetId || '—',
        name: name || '—',
        plateNumber: plate || '—',
        brand: a.manufacture || a.vehicleBrand || a.brand || '—',
        model: a.model || a.vehicleModel || '—',
        modelYear: a.modelYear || '—',
        chassisNumber: a.chassisNumber || a.vin || '—',
        category: a.categoryId?.name || a.category || '—',
        type: a.typeId?.name || a.type || '—',
        status: a.status || '—',
        assetValue: parseFloat(a.assetValue || fine?.assetValue || 0) || 0,
        purchaseDate: (a.purchaseDate || fine?.assetPurchaseDate)
            ? fmt(a.purchaseDate || fine?.assetPurchaseDate)
            : '—',
        color: a.color || a.vehicleColor || '—',
    };
}

export default function FineFormCard1({
    fine,
    formatDate,
    isCompanyFine = false,
    displayName,
    hodName,
    getEmpShare,
    getCompShare,
    fineSummaries,
    assetDetails,
    showGroupPlaceholder = false,
}) {
    const fields = useMemo(() => {
        if (!fine || !isLossDamageFineType(fine)) return null;
        return buildAssetLossFineCardFields(fine, {
            isCompanyFine,
            employeeName: displayName,
            hodName,
            getEmpShare,
            getCompShare,
            fineSummaries,
            assetDetails,
            formatDate,
        });
    }, [
        fine,
        isCompanyFine,
        displayName,
        hodName,
        getEmpShare,
        getCompShare,
        fineSummaries,
        assetDetails,
        formatDate,
    ]);

    const vehicleFields = useMemo(
        () => buildVehicleDetailFields(fine, assetDetails, formatDate),
        [fine, assetDetails, formatDate],
    );

    if (!fine) return null;

    const isLossDamage = isLossDamageFineType(fine);
    const f = fields;
    const isVehicle = resolveIsVehicleAsset(fine, assetDetails);

    if (!isLossDamage || !f) {
        return (
            <FineFormCard
                icon={FileWarning}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                title="Asset Fine Report"
                subtitle="Asset and deduction details"
            >
                {vehicleFields ? (
                    <>
                        <SectionDivider title={isVehicle ? 'Vehicle Details' : 'Asset Details'} />
                        <DetailGrid>
                            <DetailField label="Asset ID" value={vehicleFields.assetId} />
                            <DetailField label="Asset Name" value={vehicleFields.name} />
                        </DetailGrid>
                    </>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-6">
                        Available for approved Loss &amp; Damage fines.
                    </p>
                )}
            </FineFormCard>
        );
    }

    return (
        <FineFormCard
            icon={FileWarning}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            title="Asset Fine Report"
            subtitle={
                showGroupPlaceholder
                    ? 'Group request — asset, vehicle and deduction details'
                    : 'Asset and deduction details'
            }
        >
            <DetailGrid>
                <DetailField label="Fine No." value={f.fineId} />
                <DetailField label="Date" value={f.reportDate} />
            </DetailGrid>

            <div className="mt-4">
                <DetailField
                    label="Fine Description"
                    value={f.description}
                    valueClassName="font-medium text-gray-700 whitespace-pre-wrap leading-relaxed"
                />
            </div>

            <SectionDivider title="Asset & Financial Details" />
            <p className="text-xs text-gray-500 mb-4">
                Total payable = (asset{f.accessoryAmount > 0 ? ' + accessories' : ''} + service charge) − depreciation
            </p>

            <DetailGrid>
                <DetailField label="Fine Type" value={fine.fineType || f.fineCategory || '—'} />
                <DetailField label="Fine Category" value={f.fineCategory} />
                <DetailField label="Asset Aging" value={f.assetAging} />
                <DetailField
                    label="Actual Fine"
                    value={`${formatMoney(f.actualFineAmount)} AED`}
                    valueClassName="font-semibold text-red-600"
                />
                {f.accessoryAmount > 0 ? (
                    <DetailField
                        label="Accessory Amount"
                        value={`${formatMoney(f.accessoryAmount)} AED`}
                    />
                ) : null}
                <DetailField
                    label="Employee Amount"
                    value={`${formatMoney(fine.employeeAmount)} AED`}
                    valueClassName="font-semibold text-red-600"
                />
                <DetailField
                    label="Company Amount"
                    value={`${formatMoney(fine.companyAmount)} AED`}
                />
                <DetailField label="Service Charge" value={`${formatMoney(f.serviceCharge)} AED`} />
                <DetailField
                    label="Total Payable Fine"
                    value={`${formatMoney(f.totalFine)} AED`}
                    valueClassName="font-bold text-blue-600"
                />
                <DetailField label="Fine Source" value={fine.fineSource || '—'} />
                <DetailField label="Payable Type" value={f.payableTypeLabel} />
                <DetailField
                    label="Fine Payable Duration"
                    value={formatPayableDuration(fine.payableDuration)}
                />
                <DetailField
                    label="Payable From"
                    value={formatDeductionMonth(fine.monthStart) || '—'}
                />
                {!showGroupPlaceholder ? (
                    <>
                        <DetailField
                            label="Your Fine Payment"
                            value={`${formatMoney(f.yourFinePayment)} AED`}
                            valueClassName="font-semibold text-red-600"
                        />
                        <DetailField label="Others Payment" value={`${formatMoney(f.othersPayment)} AED`} />
                        <DetailField
                            label="Amount Deduct Per Month"
                            value={`${formatMoney(f.monthlyDeduction)} AED`}
                            valueClassName="font-semibold text-red-600"
                        />
                        <DetailField label="Deduction Start Date" value={f.deductionStart} />
                        <DetailField label="Deduction End Date" value={f.deductionEnd} />
                    </>
                ) : null}
                <FineAttachmentList fine={fine} />
            </DetailGrid>

            <div className="mt-4">
                <DetailField
                    label="Company Description"
                    value={fine.companyDescription || '—'}
                    valueClassName="font-medium text-gray-700 whitespace-pre-wrap leading-relaxed"
                />
            </div>

            {vehicleFields ? (
                <>
                    <SectionDivider title={isVehicle ? 'Vehicle Details' : 'Asset Details'} />
                    <DetailGrid>
                        <DetailField label="Asset ID" value={vehicleFields.assetId} />
                        <DetailField label="Asset Name" value={vehicleFields.name} />
                    </DetailGrid>
                </>
            ) : null}
        </FineFormCard>
    );
}
