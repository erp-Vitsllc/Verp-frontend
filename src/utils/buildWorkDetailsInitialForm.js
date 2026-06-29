import { resolveContractJoiningDate } from '@/utils/employeeWorkDetailsValidation';

function resolveReporteeId(reportee) {
    if (!reportee) return '';
    if (typeof reportee === 'object' && reportee !== null) {
        const id = reportee._id;
        if (id) {
            return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
        }
        return reportee.employeeId || '';
    }
    return String(reportee || '');
}

export function buildWorkDetailsInitialForm(employee, holdEntryOverride = null) {
    if (!employee) return null;

    let pendingWorkProposal = null;
    if (
        holdEntryOverride &&
        typeof holdEntryOverride === 'object' &&
        holdEntryOverride.proposedData &&
        typeof holdEntryOverride.proposedData === 'object'
    ) {
        pendingWorkProposal = holdEntryOverride;
    } else if (Array.isArray(employee?.pendingReactivationChanges)) {
        pendingWorkProposal = [...employee.pendingReactivationChanges]
            .reverse()
            .find((c) => {
                if (holdEntryOverride?._id && c?._id && String(holdEntryOverride._id) === String(c._id)) {
                    return c.proposedData && typeof c.proposedData === 'object';
                }
                return (
                    c &&
                    typeof c === 'object' &&
                    String(c.section || '').toLowerCase() === 'workdetails' &&
                    ['update', 'edit'].includes(String(c.changeType || '').toLowerCase()) &&
                    c.proposedData &&
                    typeof c.proposedData === 'object'
                );
            });
    }

    const effectiveWork = {
        ...employee,
        ...(pendingWorkProposal?.proposedData || {}),
    };

    let probationPeriod = effectiveWork.probationPeriod;
    if ((effectiveWork.status === 'Probation' || !effectiveWork.status) && !probationPeriod) {
        probationPeriod = 6;
    }

    return {
        reportingAuthority: resolveReporteeId(effectiveWork.reportingAuthority),
        overtime: effectiveWork.overtime || false,
        status: effectiveWork.status || 'Probation',
        probationPeriod,
        designation: effectiveWork.designation || '',
        department: effectiveWork.department || '',
        contractJoiningDate: resolveContractJoiningDate(employee) || '',
        dateOfJoining: effectiveWork.dateOfJoining || '',
        primaryReportee: resolveReporteeId(effectiveWork.primaryReportee),
        secondaryReportee: resolveReporteeId(effectiveWork.secondaryReportee),
        companyEmail: effectiveWork.companyEmail || '',
        company: typeof effectiveWork.company === 'object'
            ? effectiveWork.company?._id
            : (effectiveWork.company || ''),
        enablePortalAccess: effectiveWork.enablePortalAccess || false,
    };
}
