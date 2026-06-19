'use client';

import { useMemo } from 'react';
import { FileWarning } from 'lucide-react';
import { getFineSignatureState } from '@/utils/fineFormSignatures';
import {
    buildAssetLossFineCardFields,
    isLossDamageFineType,
} from './LossDamageFineDetailsSection';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    NoteBox,
    SectionDivider,
    SignatureBox,
    formatMoney,
} from './FineFormCardShared';

function amountToWords(n) {
    const num = Math.floor(Math.abs(parseFloat(n) || 0));
    if (num === 0) return 'ZERO';
    const ones = [
        '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
        'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
        'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
    ];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

    const under1000 = (x) => {
        if (x < 20) return ones[x];
        if (x < 100) {
            const t = tens[Math.floor(x / 10)];
            const o = x % 10 ? ` ${ones[x % 10]}` : '';
            return `${t}${o}`.trim();
        }
        const h = ones[Math.floor(x / 100)];
        const rem = x % 100;
        return `${h} HUNDRED${rem ? ` ${under1000(rem)}` : ''}`;
    };

    if (num < 1000) return under1000(num);
    if (num < 1000000) {
        const th = Math.floor(num / 1000);
        const rem = num % 1000;
        return `${under1000(th)} THOUSAND${rem ? ` ${under1000(rem)}` : ''}`;
    }
    return num.toLocaleString();
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

    const signatures = useMemo(
        () => getFineSignatureState(fine, { displayName, hodName }),
        [fine, displayName, hodName],
    );

    if (!fine) return null;

    const isLossDamage = isLossDamageFineType(fine);
    const f = fields;
    const employeeLabel = displayName || f?.employeeName || '—';
    const amountWords = f ? amountToWords(f.yourFinePayment) : '—';

    if (!isLossDamage || !f) {
        return (
            <FineFormCard
                icon={FileWarning}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                title="Asset Fine Report"
                subtitle="Fine acknowledgement and deduction details"
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
            subtitle="Fine acknowledgement and deduction details"
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

            <DetailGrid>
                <DetailField label="Asset Purchase Date" value={f.assetPurchaseDate} />
                <DetailField label="Asset Purchase Cost" value={`${formatMoney(f.assetPurchaseCost)} AED`} />
                <DetailField label="Asset Aging" value={f.assetAging} />
                <DetailField
                    label="Actual Fine"
                    value={`${formatMoney(f.actualFineAmount)} AED`}
                    valueClassName="font-semibold text-red-600"
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

            <NoteBox>
                I <span className="font-bold text-gray-900">{employeeLabel}</span> acknowledge that the
                fine mentioned above has been committed due to my responsibility. I understand and accept
                that I am accountable for the amount of{' '}
                <span className="font-bold text-red-600">({amountWords} DIRHAMS)</span>. I hereby authorize
                the deduction of the specified amount as mentioned from the source of income.
            </NoteBox>

            <SectionDivider title="Acknowledged By" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SignatureBox
                    label="Employee Signature"
                    name={signatures.employee?.name}
                    signed={signatures.employee?.show}
                />
                <SignatureBox
                    label="HOD Signature"
                    name={signatures.hod?.name}
                    signed={signatures.hod?.show}
                />
                <SignatureBox
                    label="HR Officer"
                    name={signatures.hr?.name}
                    signed={signatures.hr?.show}
                />
                <SignatureBox
                    label="Accounts"
                    name={signatures.accounts?.name}
                    signed={signatures.accounts?.show}
                />
            </div>
        </FineFormCard>
    );
}
