'use client';

import { Award } from 'lucide-react';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    formatMoney,
} from '../../Fine/components/FineFormCardShared';
import { formatRewardStatusLabel } from '../utils/rewardStatusDisplay';

export default function RewardFormCard1({ reward, employee, formatDate }) {
    if (!reward) return null;

    const employeeName = employee
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
        : reward.employeeName || '—';

    const amountValue =
        reward.amount != null && reward.amount !== ''
            ? `${formatMoney(reward.amount)} AED`
            : '—';

    const statusLabel = formatRewardStatusLabel(
        reward.rewardStatus || reward.approvalStatus,
        reward.rewardType
    );

    return (
        <FineFormCard
            icon={Award}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            title="Reward Details"
            subtitle="Overview of the reward record"
        >
            <DetailGrid>
                <DetailField label="Reward No." value={reward.rewardId || '—'} />
                <DetailField
                    label="Awarded Date"
                    value={formatDate(reward.awardedDate || reward.createdAt)}
                />
                <DetailField label="Employee Name" value={employeeName} />
                <DetailField label="Employee ID" value={reward.employeeId || employee?.employeeId || '—'} />
                <DetailField label="Reward Type" value={reward.rewardType || '—'} />
                <DetailField label="Status" value={statusLabel} />
                <DetailField
                    label="Amount (AED)"
                    value={amountValue}
                    valueClassName="font-bold text-blue-600"
                />
                <DetailField label="Title" value={reward.title || '—'} />
            </DetailGrid>

            <div className="mt-4">
                <DetailField
                    label="Description / Remarks"
                    value={reward.description || reward.remarks || '—'}
                    valueClassName="font-medium text-gray-700 whitespace-pre-wrap leading-relaxed"
                />
            </div>
        </FineFormCard>
    );
}
