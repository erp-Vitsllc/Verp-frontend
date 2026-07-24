'use client';

import RewardFormCard1 from './RewardFormCard1';
import RewardFormCardParties from './RewardFormCardParties';
import RewardTrackerPanel from './RewardTrackerPanel';
import RewardPaymentTab from './RewardPaymentTab';
import { isCashOrGiftReward } from '../utils/rewardPaymentPrefill';

/**
 * Reward Details tab:
 * Left 1/2 — details card + payment card underneath
 * Right 1/2 — Reward Parties (cash/gift) + vertical tracker
 */
export default function RewardFormCards({
    reward,
    employee,
    formatDate,
    onPaymentSuccess,
    canEditPartyPayables = false,
    allowPay = false,
    onPartyPayableChange,
    onPartyPayableSaved,
}) {
    if (!reward) return null;

    const showParties = isCashOrGiftReward(reward);

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="w-full lg:w-1/2 min-w-0 flex flex-col gap-6">
                <RewardFormCard1 reward={reward} employee={employee} formatDate={formatDate} />
                <RewardPaymentTab
                    reward={reward}
                    onPaymentSuccess={onPaymentSuccess}
                    allowPay={Boolean(allowPay)}
                />
            </div>
            <div className="w-full lg:w-1/2 min-w-0 flex flex-col gap-6 lg:sticky lg:top-4">
                {showParties ? (
                    <RewardFormCardParties
                        reward={reward}
                        employee={employee}
                        formatDate={formatDate}
                        canEditPartyPayables={canEditPartyPayables}
                        onPartyPayableChange={onPartyPayableChange}
                        onPartyPayableSaved={onPartyPayableSaved || onPaymentSuccess}
                    />
                ) : null}
                <RewardTrackerPanel
                    reward={reward}
                    employee={employee}
                    orientation="vertical"
                />
            </div>
        </div>
    );
}
