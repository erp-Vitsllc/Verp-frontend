'use client';

import FineFormCard1 from './FineFormCard1';
import FineFormCard2 from './FineFormCard2';
import FineFormCard3 from './FineFormCard3';
import FineFormCard4 from './FineFormCard4';
import FineFormCard5 from './FineFormCard5';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';

/**
 * Fine Form tab — two independent columns so row heights don't force-align across cards.
 * Left: Asset Fine Report → Payment Summary
 * Right: HR & Accounts → Current Deduction Schedule → New Schedule
 */
export default function FineFormCards(props) {
    const { fine } = props;

    if (!fine) return null;

    const showLossDamageCards = isLossDamageFineType(fine);

    if (!showLossDamageCards) {
        return (
            <div className="flex flex-col gap-6 w-full min-w-0 print:hidden">
                <FineFormCard1 {...props} />
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard1 {...props} />
                <FineFormCard3 {...props} />
            </div>

            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard2 {...props} />
                <FineFormCard4 {...props} />
                <FineFormCard5 {...props} />
            </div>
        </div>
    );
}
