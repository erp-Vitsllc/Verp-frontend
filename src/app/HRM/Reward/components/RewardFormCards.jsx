'use client';

import RewardFormCard1 from './RewardFormCard1';
import RewardTrackerPanel from './RewardTrackerPanel';
import RewardPaymentTab from './RewardPaymentTab';

/**
 * Reward Details tab:
 * Left 1/2 — details card + payment card underneath
 * Right 1/2 — vertical tracker
 */
export default function RewardFormCards({ reward, employee, formatDate, onPaymentSuccess }) {
    if (!reward) return null;

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="w-full lg:w-1/2 min-w-0 flex flex-col gap-6">
                <RewardFormCard1 reward={reward} employee={employee} formatDate={formatDate} />
                <RewardPaymentTab reward={reward} onPaymentSuccess={onPaymentSuccess} />
            </div>
            <div className="w-full lg:w-1/2 min-w-0 lg:sticky lg:top-4">
                <RewardTrackerPanel
                    reward={reward}
                    employee={employee}
                    orientation="vertical"
                />
            </div>
        </div>
    );
}
