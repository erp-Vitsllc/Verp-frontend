'use client';

import EntityPaymentDetailsCard from '../../shared/components/EntityPaymentDetailsCard';
import { isRewardZohoExpenseSynced } from '../utils/rewardStatusDisplay';
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
 * Payment Details — keep the card; the schedule box turns green after Zoho Expense.
 * No separate Pay button (Accounts approve marks Paid).
 */
export default function RewardPaymentTab({ reward, onPaymentSuccess }) {
    if (!reward) return null;

    const totalPayable = Number(reward.amount) || 0;
    const zohoSynced = isRewardZohoExpenseSynced(reward);
    const syncErr = Boolean(String(reward.zohoSyncError || '').trim());

    if (!isCashReward(reward) || totalPayable <= 0) {
        return (
            <FineFormCard
                icon={Banknote}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                title="Payment Details"
                subtitle="No payment amount on this reward."
            >
                <p className="text-sm text-gray-500 text-center py-8">
                    No payment amount on this reward.
                </p>
            </FineFormCard>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <EntityPaymentDetailsCard
                entityType="Reward"
                referenceId={reward.rewardId}
                relatedEntityId={reward._id}
                totalPayable={totalPayable}
                paidAmount={reward.paidAmount}
                typeLabel="Reward"
                entityRecord={reward}
                employeeId={reward.employeeId}
                isPayable={false}
                allowPay={false}
                onPaymentSuccess={onPaymentSuccess}
            />
            <p
                className={`text-[11px] font-semibold px-1 ${
                    zohoSynced ? 'text-emerald-700' : 'text-rose-700'
                }`}
            >
                {zohoSynced
                    ? `Paid — Zoho Expense synced${reward.zohoExpenseNumber ? ` (${reward.zohoExpenseNumber})` : ''}`
                    : syncErr
                      ? `Payment schedule stays unpaid until Zoho succeeds — ${reward.zohoSyncError}`
                      : 'Payment schedule turns green after Zoho Expense posts on Accounts approval'}
            </p>
        </div>
    );
}
