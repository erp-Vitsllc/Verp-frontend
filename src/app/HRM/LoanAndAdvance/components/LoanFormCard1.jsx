'use client';

import { FileText } from 'lucide-react';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    formatMoney,
} from '../../Fine/components/FineFormCardShared';

export default function LoanFormCard1({ loan, employee, formatDate, typeLabel }) {
    if (!loan) return null;

    const isLoan = loan.type === 'Loan';
    const title = isLoan ? 'Loan Application Details' : 'Salary Advance Application Details';
    const subtitle = isLoan ? 'Applicant and request information' : 'Advance request information';

    return (
        <FineFormCard
            icon={FileText}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            title={title}
            subtitle={subtitle}
        >
            <DetailGrid>
                <DetailField label={`${typeLabel} No.`} value={loan.loanId || '—'} />
                <DetailField label="Date" value={formatDate(loan.appliedDate || loan.createdAt)} />
                <DetailField label="Applicant Name" value={loan.applicantName} />
                <DetailField label="Department" value={loan.department} />
                <DetailField label="Designation" value={loan.designation} />
                <DetailField label="HOD Name" value={loan.hodName} />
                <DetailField
                    label="Amount (AED)"
                    value={`${formatMoney(loan.amount)} AED`}
                    valueClassName="font-bold text-blue-600"
                />
                <DetailField label="Status" value={loan.approvalStatus || loan.status} />
            </DetailGrid>

            <div className="mt-4">
                <DetailField
                    label="Reason"
                    value={loan.reason || '—'}
                    valueClassName="font-medium text-gray-700 whitespace-pre-wrap leading-relaxed"
                />
            </div>
        </FineFormCard>
    );
}
