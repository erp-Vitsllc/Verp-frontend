'use client';

import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { deriveFineScheduleMonthYears } from '../utils/fineScheduleUtils';
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
    formatServiceTenure,
} from './FineFormCardShared';

function resolveVisaExpiry(employee) {
    if (!employee?.visaDetails) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isValid = (dateStr) => dateStr && new Date(dateStr) >= today;
    const details = employee.visaDetails;
    if (isValid(details.employment?.expiryDate)) return details.employment.expiryDate;
    if (isValid(details.spouse?.expiryDate)) return details.spouse.expiryDate;
    if (isValid(details.visit?.expiryDate)) return details.visit.expiryDate;
    return details.employment?.expiryDate || details.spouse?.expiryDate || details.visit?.expiryDate || null;
}

function resolveSalary(employee) {
    if (!employee) return { monthly: 0, basic: 0 };
    const history = Array.isArray(employee.salaryHistory) ? employee.salaryHistory : [];
    const activeEntry = history.find((e) => e.isActive) || history[history.length - 1];
    const monthly =
        parseFloat(employee.monthlySalary) ||
        parseFloat(employee.totalSalary) ||
        parseFloat(activeEntry?.totalSalary) ||
        parseFloat(activeEntry?.monthlySalary) ||
        0;
    const basic =
        parseFloat(employee.basicSalary) ||
        parseFloat(employee.basic) ||
        parseFloat(activeEntry?.basicSalary) ||
        0;
    return { monthly, basic };
}

export default function FineFormCard2({
    fine,
    formatDate,
    isCompanyFine = false,
    displayName,
    hodName,
    mainEmployee,
    fineSummaries,
    getEmpShare,
    getCompShare,
    assetDetails,
}) {
    const fineFields = useMemo(() => {
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

    const fields = useMemo(() => {
        if (!fine) return null;

        const stats = fine.formSummary?.employeeStats || {};
        const employee = mainEmployee || {};
        const joiningDate =
            employee.dateOfJoining ||
            employee.contractJoiningDate ||
            stats.joiningDate ||
            null;
        const labourExpiry =
            employee.labourCardDetails?.expiryDate ||
            employee.labourCardExpiryDate ||
            stats.labourCardExpiry ||
            null;
        const visaExpiry = resolveVisaExpiry(employee) || stats.visaExpiry || null;
        const { monthly, basic } = resolveSalary(employee);
        const newFine = getEmpShare ? getEmpShare(fine) : parseFloat(fine.employeeAmount || fine.fineAmount || 0);
        const currentOutstanding = parseFloat(fineSummaries?.outstandingBalance || 0);
        const duration =
            (fine.sourceOfIncome || 'Salary') === 'End of Service'
                ? 1
                : Math.max(1, parseInt(fine.payableDuration, 10) || 1);
        const fmt = formatDate || ((d) => (d ? new Date(d).toLocaleDateString() : '—'));
        const fineSchedule = deriveFineScheduleMonthYears(fine);
        const isEosFine = (fine.sourceOfIncome || 'Salary') === 'End of Service';

        return {
            labourCardExpiry: fmt(labourExpiry),
            visaExpiry: fmt(visaExpiry),
            joiningDate: fmt(joiningDate),
            serviceTenure: stats.serviceYears || formatServiceTenure(joiningDate),
            currentOutstanding,
            newFine,
            monthlySalary: monthly,
            basicSalary: basic,
            paymentType: isEosFine
                ? 'End of Service'
                : `${duration} Month${duration !== 1 ? 's' : ''} Installment`,
            deductionStart: isEosFine
                ? '—'
                : formatDeductionMonth(fine.monthStart || fine.awardedDate || fineSchedule.startMonthYear),
            deductionEnd: isEosFine
                ? '—'
                : formatDeductionMonth(fineSchedule.endMonthYear),
        };
    }, [fine, mainEmployee, fineSummaries, getEmpShare, formatDate]);

    if (!fine || !isLossDamageFineType(fine) || isCompanyFine || !fields || !fineFields) return null;

    const sourceLabel =
        fineFields.sourceOfDeduction === 'End of Service'
            ? 'End of Service'
            : fineFields.sourceOfDeduction === 'Self Pay'
              ? 'Self Pay'
              : 'Salary';

    return (
        <FineFormCard
            icon={Building2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            title="HR and Accounts Department"
            subtitle="Employee records and salary information"
        >
            <DetailGrid>
                <DetailField label="Labour Card Expiry" value={fields.labourCardExpiry} />
                <DetailField label="Visa Expiry" value={fields.visaExpiry} />
                <DetailField label="Joining Date" value={fields.joiningDate} />
                <DetailField label="Year of Service" value={fields.serviceTenure} />
            </DetailGrid>

            <SectionDivider title="Employee & Fine Assignment" />

            <DetailGrid>
                <DetailField label="Employee Name" value={displayName || fineFields.employeeName} />
                <DetailField label="HOD Name" value={fineFields.hodName} />
                <DetailField label="Fine Type" value={fineFields.fineCategory} />
                <DetailField label="Payable Type" value={fineFields.payableTypeLabel} />
                <DetailField label="Source of Deduction" value={sourceLabel} />
                <DetailField
                    label="Current Outstanding Amount"
                    value={`${formatMoney(fields.currentOutstanding)} AED`}
                    valueClassName="font-semibold text-red-600"
                />
                <DetailField
                    label="New Fine"
                    value={`${formatMoney(fields.newFine)} AED`}
                    valueClassName="font-semibold text-red-600"
                />
                <DetailField label="Monthly Salary" value={`${formatMoney(fields.monthlySalary)} AED`} />
                <DetailField label="Basic Salary" value={`${formatMoney(fields.basicSalary)} AED`} />
                <DetailField label="Payment Type" value={fields.paymentType} />
                <DetailField label="Deduction Start Month" value={fields.deductionStart} />
                <DetailField label="Deduction End Month" value={fields.deductionEnd} />
            </DetailGrid>
        </FineFormCard>
    );
}
