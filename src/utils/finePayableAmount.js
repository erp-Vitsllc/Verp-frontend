function isCompanyParty(emp) {
    if (!emp) return false;
    const id = emp.employeeId;
    const name = String(emp.employeeName || '').trim();
    return id === 'VEGA-HR-0000' || id === 'VEGA_INTERNAL' || name === 'Vega Digital IT Solutions';
}

/**
 * One party's share of service charge.
 * Split sibling records already store this party's share on fine.serviceCharge — do not halve again.
 */
export function resolvePartyServiceShare(fine, entry, isCompanyPartyFlag = false) {
    const perRecord = parseFloat(entry?.serviceCharge ?? 0) || 0;
    if (perRecord > 0) return perRecord;

    const totalSc = parseFloat(fine?.serviceCharge || 0) || 0;
    if (totalSc <= 0) return 0;

    const rf = (fine?.responsibleFor || 'Employee').trim();
    const assignees = (fine?.assignedEmployees || []).filter(
        (ae) => ae?.employeeId && ae.employeeId !== 'PENDING',
    );
    const partyCount = assignees.length;

    if (rf === 'Company') {
        return isCompanyPartyFlag ? totalSc : 0;
    }
    if (rf !== 'Employee & Company') {
        return isCompanyPartyFlag ? 0 : totalSc;
    }

    // Employee & Company — sibling docs: root SC is already this party's share
    if (!fine?.isGroupView && partyCount <= 1) {
        return totalSc;
    }

    // Group / multi-party document: divide full SC equally among parties
    const n = Math.max(partyCount, 2);
    return totalSc / n;
}

function resolveRowBaseAmount(fine, entry, isCompanyPartyFlag) {
    let base = parseFloat(entry?.employeeAmount) || 0;
    if (base <= 0) {
        if (isCompanyPartyFlag) {
            base = parseFloat(fine?.companyAmount) || 0;
            // Company sibling stores company base in employeeAmount (companyAmount is 0)
            if (base <= 0 && (fine?.assignedEmployees || []).length <= 1) {
                base = parseFloat(fine?.employeeAmount) || 0;
            }
        } else {
            base = parseFloat(fine?.employeeAmount) || 0;
        }
    }
    const totalSc = parseFloat(fine?.serviceCharge || 0) || 0;
    if (base < 0 && totalSc > 0) {
        base += totalSc;
    }
    return Math.max(0, base);
}

/**
 * Employee payable total = fine base + service charge (counted once).
 * Used on Fine list, Payment Summary, deduction schedules, and detail forms.
 */
export function resolveEmployeeFinePayableAmount(fine, employeeId) {
    if (!fine || !employeeId) return 0;
    if ((fine.responsibleFor || '').toLowerCase() === 'company') return 0;

    const entry = (fine.assignedEmployees || []).find(
        (ae) => ae.employeeId === employeeId && ae.employeeId !== 'VEGA-HR-0000',
    );
    if (!entry) return 0;

    const rowBase = resolveRowBaseAmount(fine, entry, false);
    const sc = resolvePartyServiceShare(fine, entry, false);
    const expected = Number((rowBase + sc).toFixed(2));

    if (entry.individualAmount != null && entry.individualAmount !== '') {
        const stored = parseFloat(entry.individualAmount) || 0;
        if (stored > 0) {
            if (sc > 0 && rowBase > 0 && stored < expected - 0.01) return expected;
            return Math.max(stored, expected > 0 ? expected : 0);
        }
    }
    if (entry.fineAmount != null && entry.fineAmount !== '') {
        const stored = parseFloat(entry.fineAmount) || 0;
        if (stored > 0) {
            if (sc > 0 && rowBase > 0 && stored < expected - 0.01) return expected;
            if (sc > 0 && Math.abs(stored - rowBase) < 0.01) return expected;
            return Math.max(stored, expected > 0 ? expected : 0);
        }
    }

    if (expected > 0) return expected;

    const companyAmount = parseFloat(fine.companyAmount || 0) || 0;
    const fineAmount = parseFloat(fine.fineAmount || fine.totalFineAmount || 0) || 0;
    const humanAssignees = (fine.assignedEmployees || []).filter(
        (ae) => ae.employeeId && ae.employeeId !== 'VEGA-HR-0000' && ae.employeeId !== 'PENDING',
    );

    if (humanAssignees.length <= 1 && companyAmount === 0 && fineAmount > 0) {
        const totalSc = parseFloat(fine.serviceCharge || 0) || 0;
        if (totalSc > 0 && fineAmount < rowBase + totalSc - 0.01 && rowBase > 0) {
            return Number((rowBase + totalSc).toFixed(2));
        }
        return fineAmount;
    }

    return 0;
}

/** Company / Vega party payable = company base + service share (once). */
export function resolveCompanyFinePayableAmount(fine, companyEntry = null) {
    if (!fine) return 0;

    const entry =
        companyEntry ||
        (fine.assignedEmployees || []).find(isCompanyParty) ||
        (fine.assignedEmployees || []).find((e) => e.employeeId === 'VEGA-HR-0000');

    const rowBase = resolveRowBaseAmount(fine, entry, true);
    const sc = resolvePartyServiceShare(fine, entry, true);
    const expected = Number((rowBase + sc).toFixed(2));

    if (entry?.individualAmount != null && entry.individualAmount !== '') {
        const stored = parseFloat(entry.individualAmount) || 0;
        if (stored > 0) {
            if (sc > 0 && rowBase > 0 && stored < expected - 0.01) return expected;
            return Math.max(stored, expected > 0 ? expected : 0);
        }
    }
    if (entry?.fineAmount != null && entry.fineAmount !== '') {
        const stored = parseFloat(entry.fineAmount) || 0;
        if (stored > 0) {
            if (sc > 0 && rowBase > 0 && stored < expected - 0.01) return expected;
            if (sc > 0 && Math.abs(stored - rowBase) < 0.01) return expected;
            return Math.max(stored, expected > 0 ? expected : 0);
        }
    }

    if (expected > 0) return expected;

    const rf = (fine.responsibleFor || '').trim();
    if (rf === 'Company') {
        const fineAmount = parseFloat(fine.fineAmount || fine.totalFineAmount || 0) || 0;
        if (fineAmount > 0) return fineAmount;
    }

    return 0;
}

/** @deprecated Use resolveEmployeeFinePayableAmount */
export const resolveEmployeeFineListAmount = resolveEmployeeFinePayableAmount;
