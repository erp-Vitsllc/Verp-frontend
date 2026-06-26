'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { buildCurrentDeductionSchedule, getDeductionScheduleSubtitles } from './buildDeductionSchedule';
import DeductionScheduleBoxes from './DeductionScheduleBoxes';
import { FineFormCard } from './FineFormCardShared';

export default function FineFormCard4({
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
            buildCurrentDeductionSchedule({
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
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                title="Current Deduction Schedule"
                subtitle={subtitles.current}
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
            subtitle={subtitles.current}
            boxes={schedule.boxes}
            eosBoxes={schedule.eosBoxes}
            variant="current"
        />
    );
}
