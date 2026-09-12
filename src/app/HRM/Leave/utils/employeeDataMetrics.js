function n(value) {
    return Number(value) || 0;
}

function requestBucket(stats, key) {
    return stats?.[key] || {};
}

function combineLateEarly(requestStats, enroll) {
    const combined = requestBucket(requestStats, 'late_early');
    const late = requestBucket(requestStats, 'late_arrived');
    const early = requestBucket(requestStats, 'early_go');
    return {
        total: n(enroll?.late) + n(enroll?.early) || n(combined.total) || n(late.total) + n(early.total),
        approved: n(combined.approved) || n(late.approved) + n(early.approved),
        rejected: n(combined.rejected) || n(late.rejected) + n(early.rejected),
    };
}

function sickAllowedDays(ctx, balances) {
    const allowed = balances.sick_leave?.allowed;
    if (allowed != null && allowed !== '') return n(allowed);
    const policy = ctx.leavePolicy || {};
    if (policy.sickAllowedDays != null && policy.sickAllowedDays !== '') return n(policy.sickAllowedDays);
    if (policy.allowedSickLeaveDaysPerYear != null && policy.allowedSickLeaveDaysPerYear !== '') {
        return n(policy.allowedSickLeaveDaysPerYear);
    }
    return 0;
}

/** Same leave metrics as the attendance profile Employee data rows. */
export function employeeDataMetrics(row, ctx) {
    const enroll = ctx.enrollAttendance || {};
    const balances = ctx.leaveBalances || {};
    const stats = requestBucket(ctx.requestStats, row.key);
    const taken = n(balances[row.key]?.taken);

    if (row.key === 'on_leave') {
        const cycle = ctx.annualLeave || {};
        const eligible =
            cycle.leaveEligible === true ||
            cycle.eligible === true ||
            n(cycle.completedCycles) > 0;
        const used = n(balances.on_leave?.taken);
        const allowed = eligible
            ? n(balances.on_leave?.allowed) || n(ctx.leavePolicy?.annualAllowedDays)
            : 0;
        return [
            { label: 'Approved', value: allowed },
            { label: 'Used', value: used },
            { label: 'Remaining', value: eligible ? n(balances.on_leave?.remaining ?? Math.max(0, allowed - used)) : 0 },
        ];
    }
    if (row.key === 'authorized_leave') {
        return [
            { label: 'Total', value: taken },
            { label: 'Approved', value: taken },
            { label: 'Rejected', value: n(stats.rejected) },
        ];
    }
    if (row.key === 'unauthorized_leave') {
        return [
            { label: 'Request', value: n(stats.request) },
            { label: 'Approved', value: taken },
            { label: 'Rejected', value: n(stats.rejected) },
        ];
    }
    if (row.key === 'sick_leave') {
        const available = sickAllowedDays(ctx, balances);
        const used = n(balances.sick_leave?.taken);
        return [
            { label: 'Available', value: available },
            { label: 'Used', value: used },
            { label: 'Remaining', value: n(balances.sick_leave?.remaining ?? Math.max(0, available - used)) },
        ];
    }
    if (row.key === 'compoff_leave') {
        const used = n(balances.compoff_leave?.taken);
        const remaining = n(balances.compoff_leave?.remaining);
        return [
            { label: 'Balance', value: used + remaining },
            { label: 'Used', value: used },
            { label: 'Remaining', value: remaining },
        ];
    }
    if (row.key === 'late_early') {
        const lateEarly = combineLateEarly(ctx.requestStats, enroll);
        return [
            { label: 'Total', value: lateEarly.total },
            { label: 'Approved', value: lateEarly.approved },
            { label: 'Rejected', value: lateEarly.rejected },
        ];
    }
    if (row.key === 'mispunch') {
        return [
            { label: 'Total', value: n(enroll.mispunch) || n(stats.total) },
            { label: 'Approved', value: n(stats.approved) },
            { label: 'Present', value: n(stats.present) },
        ];
    }
    return [
        { label: 'Office', value: n(enroll.office ?? ctx.presentDays) },
        { label: 'WFH', value: n(enroll.wfh) },
        { label: 'Absent', value: n(enroll.absent ?? ctx.absentDays) },
    ];
}

export { n as metricNumber };
