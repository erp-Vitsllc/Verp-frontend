function isCompanyParty(emp) {
    if (!emp) return false;
    const id = emp.employeeId;
    const name = String(emp.employeeName || '').trim();
    return id === 'VEGA-HR-0000' || id === 'VEGA_INTERNAL' || name === 'Vega Digital IT Solutions';
}

/**
 * One party's share of service charge (never counted twice on top of individualAmount).
 */
export function resolvePartyServiceShare(fine, entry, isCompanyParty = false) {
    const perRecord = parseFloat(entry?.serviceCharge ?? 0) || 0;
    if (perRecord > 0) return perRecord;

    const totalSc = parseFloat(fine?.serviceCharge || 0) || 0;
    const rf = (fine?.responsibleFor || 'Employee').trim();
    if (rf !== 'Employee & Company' || totalSc <= 0) {
        return isCompanyParty ? 0 : totalSc;
    }
    if (fine?.isGroupView || (fine?.assignedEmployees?.length || 0) > 1) {
        return totalSc / 2;
    }
    const comp = parseFloat(fine?.companyAmount || 0) || 0;
    const hasVega = fine?.assignedEmployees?.some((e) => e.employeeId === 'VEGA-HR-0000');
    if (hasVega || comp > 0) return totalSc / 2;
    return totalSc;
}

function resolveRowBaseAmount(fine, entry, isCompanyParty) {
    let base = parseFloat(
        entry?.employeeAmount ??
        (isCompanyParty ? fine?.companyAmount : fine?.employeeAmount) ??
        0,
    ) || 0;
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

    if (entry.individualAmount != null && entry.individualAmount !== '') {
        const stored = parseFloat(entry.individualAmount) || 0;
        if (stored > 0) return stored;
    }
    if (entry.fineAmount != null && entry.fineAmount !== '') {
        const stored = parseFloat(entry.fineAmount) || 0;
        if (stored > 0) return stored;
    }

    const rowBase = resolveRowBaseAmount(fine, entry, false);
    if (rowBase > 0) {
        return rowBase + resolvePartyServiceShare(fine, entry, false);
    }

    const companyAmount = parseFloat(fine.companyAmount || 0) || 0;
    const fineAmount = parseFloat(fine.fineAmount || fine.totalFineAmount || 0) || 0;
    const humanAssignees = (fine.assignedEmployees || []).filter(
        (ae) => ae.employeeId && ae.employeeId !== 'VEGA-HR-0000' && ae.employeeId !== 'PENDING',
    );

    if (humanAssignees.length <= 1 && companyAmount === 0 && fineAmount > 0) {
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

    if (entry?.individualAmount != null && entry.individualAmount !== '') {
        const stored = parseFloat(entry.individualAmount) || 0;
        if (stored > 0) return stored;
    }
    if (entry?.fineAmount != null && entry.fineAmount !== '') {
        const stored = parseFloat(entry.fineAmount) || 0;
        if (stored > 0) return stored;
    }

    const rowBase = resolveRowBaseAmount(fine, entry, true);
    if (rowBase > 0) {
        return rowBase + resolvePartyServiceShare(fine, entry, true);
    }

    const rf = (fine.responsibleFor || '').trim();
    if (rf === 'Company') {
        const fineAmount = parseFloat(fine.fineAmount || fine.totalFineAmount || 0) || 0;
        if (fineAmount > 0) return fineAmount;
    }

    return 0;
}

/** @deprecated Use resolveEmployeeFinePayableAmount */
export const resolveEmployeeFineListAmount = resolveEmployeeFinePayableAmount;
