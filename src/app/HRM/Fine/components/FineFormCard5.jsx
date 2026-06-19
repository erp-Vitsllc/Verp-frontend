'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';
import { buildNewDeductionSchedule } from './buildDeductionSchedule';
import DeductionScheduleBoxes from './DeductionScheduleBoxes';
import { FineFormCard } from './FineFormCardShared';

export default function FineFormCard5({
    fine,
    isCompanyFine = false,
    fineSummaries,
    allEmployeeFines = [],
    getEmpShare,
}) {
    const schedule = useMemo(
        () =>
            buildNewDeductionSchedule({
                fine,
                fineSummaries,
                allEmployeeFines,
                getEmpShare,
            }),
        [fine, fineSummaries, allEmployeeFines, getEmpShare],
    );

    if (!fine || !isLossDamageFineType(fine) || isCompanyFine) return null;

    if (!schedule.boxes?.length) {
        return (
            <FineFormCard
                icon={Calendar}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                title="New Schedule"
                subtitle="Latest schedule after HR review — includes this fine with any edits."
            >
                <p className="text-sm text-gray-500 text-center py-8">
                    No deduction schedule available for this fine yet.
                </p>
            </FineFormCard>
        );
    }

    return (
        <DeductionScheduleBoxes
            title="New Schedule"
            subtitle="Latest schedule after HR review — includes this fine with any edits."
            boxes={schedule.boxes}
            variant="new"
        />
    );
}
