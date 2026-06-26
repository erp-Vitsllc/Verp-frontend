'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { buildNewDeductionSchedule, getDeductionScheduleSubtitles } from './buildDeductionSchedule';
import DeductionScheduleBoxes from './DeductionScheduleBoxes';
import { FineFormCard } from './FineFormCardShared';

export default function FineFormCard5({
    fine,
    isCompanyFine = false,
    fineSummaries,
    allEmployeeFines = [],
    allEmployeeLoans = [],
    viewingLoan = null,
    employeeOwnerId,
    showFinancialCards = false,
}) {
    const subtitles = useMemo(() => getDeductionScheduleSubtitles(fine, viewingLoan), [fine, viewingLoan]);

    const schedule = useMemo(
        () =>
            buildNewDeductionSchedule({
                fine,
                employeeId: employeeOwnerId,
                fineSummaries,
                allEmployeeFines,
                allEmployeeLoans,
                viewingLoan,
            }),
        [fine, employeeOwnerId, fineSummaries, allEmployeeFines, allEmployeeLoans, viewingLoan],
    );

    const showEmployeeFinancials =
        showFinancialCards || (Boolean(employeeOwnerId) && !isCompanyFine);

    if (!showEmployeeFinancials) return null;

    if (!schedule.boxes?.length && !schedule.eosBoxes?.length) {
        return (
            <FineFormCard
                icon={Calendar}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                title="New Schedule"
                subtitle={subtitles.new}
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
            subtitle={subtitles.new}
            boxes={schedule.boxes}
            eosBoxes={schedule.eosBoxes}
            variant="new"
        />
    );
}
