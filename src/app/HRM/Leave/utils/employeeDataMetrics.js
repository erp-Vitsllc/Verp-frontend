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
        request: n(combined.request) || n(late.request) + n(early.request),
        approved: n(combined.approved) || n(late.approved) + n(early.approved),
        rejected: n(combined.rejected) || n(late.rejected) + n(early.rejected),
    };
}

function pendingUsedRemaining(pending, used, remaining) {
    return [
        { label: 'Pending', value: n(pending) },
        { label: 'Used', value: n(used) },
        { label: 'Remaining', value: n(remaining) },
    ];
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

function annualGrantDays(ctx, balances) {
    const allowed = n(balances.on_leave?.allowed);
    if (allowed > 0) return allowed;
    return n(ctx.leavePolicy?.annualAllowedDays);
}

/**
 * 30-day annual grant only after THIS cycle reaches 300 working days.
 * 139 / 300 with remaining days left must stay 0 — never use policy 30 or
 * leaveEligible, which can be true before the kick.
 */
function annualGrantUnlocked(cycle = {}) {
    const toward = n(cycle.eligibleDays ?? cycle.presentDays);
    const remainingToKick = n(cycle.remainingDays);
    const required = n(cycle.requiredPresentDays) || remainingToKick + toward;
    if (required > 0 && toward > 0 && toward < required) return false;
    if (cycle.grantUnlocked === false || (cycle.grantDays != null && n(cycle.grantDays) <= 0)) {
        return false;
    }
    if (cycle.grantUnlocked === true) return true;
    return n(cycle.completedCycles) > 0;
}

/** Same leave metrics as the attendance profile Employee data rows. */
export function employeeDataMetrics(row, ctx) {
    const enroll = ctx.enrollAttendance || {};
    const balances = ctx.leaveBalances || {};
    const stats = requestBucket(ctx.requestStats, row.key);
    const taken = n(balances[row.key]?.taken);

    if (row.key === 'on_leave') {
        const cycle = ctx.annualLeave || {};
        if (!annualGrantUnlocked(cycle)) {
            return pendingUsedRemaining(0, 0, 0);
        }
        const used = n(balances.on_leave?.taken);
        const grant = n(cycle.grantDays) || annualGrantDays(ctx, balances);
        const remaining = Math.max(0, grant - used);
        return pendingUsedRemaining(remaining, used, remaining);
    }
    if (row.key === 'authorized_leave') {
        return pendingUsedRemaining(n(stats.request), taken, 0);
    }
    if (row.key === 'unauthorized_leave') {
        return pendingUsedRemaining(n(stats.request), taken, 0);
    }
    if (row.key === 'sick_leave') {
        const available = sickAllowedDays(ctx, balances);
        const used = n(balances.sick_leave?.taken);
        const remaining = n(balances.sick_leave?.remaining ?? Math.max(0, available - used));
        return pendingUsedRemaining(remaining, used, remaining);
    }
    if (row.key === 'compoff_leave') {
        const used = n(ctx.counts?.compoff_leave ?? balances.compoff_leave?.taken);
        const remaining = n(balances.compoff_leave?.remaining);
        return pendingUsedRemaining(remaining, used, remaining);
    }
    if (row.key === 'late_early') {
        const lateEarly = combineLateEarly(ctx.requestStats, enroll);
        return pendingUsedRemaining(lateEarly.request, lateEarly.total, 0);
    }
    if (row.key === 'mispunch') {
        return pendingUsedRemaining(
            n(stats.request),
            n(enroll.mispunch) || n(stats.total),
            n(stats.present),
        );
    }
    return [
        { label: 'Office', value: n(enroll.office ?? ctx.presentDays) },
        { label: 'WFH', value: n(enroll.wfh) },
        { label: 'Absent', value: n(enroll.absent ?? ctx.absentDays) },
    ];
}

export { n as metricNumber };
