'use client';

import EntityPaymentDetailsCard from '../../shared/components/EntityPaymentDetailsCard';
import { isRewardPaymentEligible } from '../utils/rewardStatusDisplay';
import { FineFormCard } from '../../Fine/components/FineFormCardShared';
import { Banknote } from 'lucide-react';

function isCashReward(reward) {
    const type = String(reward?.rewardType || '').toLowerCase();
    return (
        type.includes('cash') ||
        type.includes('gift') ||
        type.includes('bonus') ||
        Number(reward?.amount) > 0
    );
}

/**
 * Payment Details card — same pattern as Fine (under reward details).
 */
export default function RewardPaymentTab({ reward, onPaymentSuccess, allowPay = true }) {
    if (!reward) return null;

    const totalPayable = Number(reward.amount) || 0;

    if (!isCashReward(reward) || totalPayable <= 0) {
        return (
            <FineFormCard
                icon={Banknote}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                title="Payment Details"
                subtitle="Payments recorded against this reward"
            >
                <p className="text-sm text-gray-500 text-center py-8">
                    No payment amount on this reward.
                </p>
            </FineFormCard>
        );
    }

    return (
        <EntityPaymentDetailsCard
            entityType="Reward"
            referenceId={reward.rewardId}
            relatedEntityId={reward._id}
            totalPayable={totalPayable}
            paidAmount={reward.paidAmount}
            typeLabel="Reward"
            entityRecord={reward}
            employeeId={reward.employeeId}
            isPayable={isRewardPaymentEligible(reward)}
            allowPay={Boolean(allowPay)}
            onPaymentSuccess={onPaymentSuccess}
        />
    );
}
