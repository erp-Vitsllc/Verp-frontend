'use client';

import { useMemo } from 'react';
import { FileWarning } from 'lucide-react';
import {
    buildAssetLossFineCardFields,
    isLossDamageFineType,
} from './LossDamageFineDetailsSection';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    SectionDivider,
    formatMoney,
} from './FineFormCardShared';

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

    if (!fine) return null;

    const isLossDamage = isLossDamageFineType(fine);
    const f = fields;

    if (!isLossDamage || !f) {
        return (
            <FineFormCard
                icon={FileWarning}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                title="Asset Fine Report"
                subtitle="Asset and deduction details"
            >
                <p className="text-sm text-gray-500 text-center py-6">
                    Available for approved Loss &amp; Damage fines.
                </p>
            </FineFormCard>
        );
    }

    return (
        <FineFormCard
            icon={FileWarning}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            title="Asset Fine Report"
            subtitle="Asset and deduction details"
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
                <DetailField label="Asset Purchase Date" value={f.assetPurchaseDate} />
                <DetailField label="Asset Purchase Cost" value={`${formatMoney(f.assetPurchaseCost)} AED`} />
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
                    label="Asset Depreciation Amount"
                    value={`${formatMoney(f.assetDepreciationAmount)} AED`}
                />
                <DetailField label="Service Charge" value={`${formatMoney(f.serviceCharge)} AED`} />
                <DetailField
                    label="Total Payable Fine"
                    value={`${formatMoney(f.totalFine)} AED`}
                    valueClassName="font-bold text-blue-600"
                />
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
            </DetailGrid>
        </FineFormCard>
    );
}
