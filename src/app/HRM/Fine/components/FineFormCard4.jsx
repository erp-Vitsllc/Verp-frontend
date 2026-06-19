'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';
import { buildCurrentDeductionSchedule } from './buildDeductionSchedule';
import DeductionScheduleBoxes from './DeductionScheduleBoxes';
import { FineFormCard } from './FineFormCardShared';

export default function FineFormCard4({
    fine,
    isCompanyFine = false,
    fineSummaries,
    allEmployeeFines = [],
    getEmpShare,
}) {
    const schedule = useMemo(
        () =>
            buildCurrentDeductionSchedule({
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
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                title="Current Deduction Schedule"
                subtitle="Schedule frozen when this fine was approved — does not change after HR edits."
            >
                <p className="text-sm text-gray-500 text-center py-8">
                    No deduction schedule was set when this fine was approved.
                </p>
            </FineFormCard>
        );
    }

    return (
        <DeductionScheduleBoxes
            title="Current Deduction Schedule"
            subtitle="Schedule frozen when this fine was approved — does not change after HR edits."
            boxes={schedule.boxes}
            variant="current"
        />
    );
}
