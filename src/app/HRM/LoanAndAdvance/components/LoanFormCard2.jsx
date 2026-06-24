'use client';

import { Building2 } from 'lucide-react';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    SectionDivider,
    formatMoney,
    formatServiceTenure,
} from '../../Fine/components/FineFormCardShared';

function resolveVisaExpiry(employee) {
    if (!employee?.visaDetails) return null;
    return (
        employee.visaDetails.employment?.expiryDate ||
        employee.visaDetails.spouse?.expiryDate ||
        employee.visaDetails.visit?.expiryDate ||
        null
    );
}

export default function LoanFormCard2({
    loan,
    employee,
    formatDate,
    previousLoanAmount,
    calculateServiceYears,
}) {
    if (!loan) return null;

    const joiningDate = employee?.dateOfJoining || employee?.contractJoiningDate;
    const serviceTenure = calculateServiceYears
        ? calculateServiceYears(joiningDate)
        : formatServiceTenure(joiningDate);
    const monthlySalary = Number(employee?.totalSalary || employee?.monthlySalary || 0);

    return (
        <FineFormCard
            icon={Building2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            title="HR and Accounts Department"
            subtitle="Employee records and salary information"
        >
            <DetailGrid>
                <DetailField label="Employee No." value={employee?.employeeId || loan.employeeId} />
                <DetailField label="Labour Card Expiry" value={formatDate(employee?.labourCardDetails?.expiryDate)} />
                <DetailField label="Visa Expiry" value={formatDate(resolveVisaExpiry(employee))} />
                <DetailField label="Joining Date" value={formatDate(joiningDate)} />
                <DetailField label="Year of Service" value={serviceTenure} />
                <DetailField label="Salary Payable (AED)" value={`${formatMoney(monthlySalary)} AED`} />
            </DetailGrid>

            <SectionDivider title="Finance Records" />

            <DetailGrid>
                <DetailField
                    label={`Previous ${loan.type === 'Loan' ? 'Loan' : 'Advance'} if any (AED)`}
                    value={previousLoanAmount ? `${formatMoney(previousLoanAmount)} AED` : '—'}
                />
                <DetailField label="Applicant Department" value={loan.department} />
                <DetailField label="HOD Name" value={loan.hodName} />
                <DetailField label="HR HOD" value={loan.hrHODName || '—'} />
                <DetailField label="Accounts HOD" value={loan.accountsHODName || '—'} />
                <DetailField label="Management Approver" value={loan.ceoName || '—'} />
            </DetailGrid>
        </FineFormCard>
    );
}
