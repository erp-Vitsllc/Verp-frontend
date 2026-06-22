import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';
import { APPROVED_FINE_STATUSES } from './fineScheduleUtils';

export { resolveEmployeeFinePayableAmount, resolveEmployeeFineListAmount } from '@/utils/finePayableAmount';

const CATEGORY_KEYS = ['Vehicle', 'Safety', 'Project', 'Loss', 'Other'];

export function categorizeEmployeeFine(f) {
    const fType = (f.fineType || f.category || f.subCategory || '').toLowerCase();
    if (fType.includes('vehicle')) return 'Vehicle';
    if (fType.includes('safety')) return 'Safety';
    if (fType.includes('project')) return 'Project';
    if (fType.includes('loss and damage')) return 'Loss';
    if (fType.includes('loss') || (fType.includes('damage') && !fType.includes('other'))) return 'Loss';
    if (fType.includes('property')) return 'Loss';
    return 'Other';
}

function emptyAggregates() {
    return {
        Vehicle: { amount: 0, paid: 0, count: 0, duration: 0 },
        Safety: { amount: 0, paid: 0, count: 0, duration: 0 },
        Project: { amount: 0, paid: 0, count: 0, duration: 0 },
        Loss: { amount: 0, paid: 0, count: 0, duration: 0 },
        Other: { amount: 0, paid: 0, count: 0, duration: 0 },
    };
}

function normalizeFineId(value) {
    if (!value || typeof value !== 'string') return '';
    return value.trim().toUpperCase();
}

function fineBaseId(fineId) {
    const id = normalizeFineId(fineId);
    const match = id.match(/^(VEGA-FINE-\d+)/i);
    return match ? match[1].toUpperCase() : id;
}

export function isSameEmployeeFine(a, b) {
    if (!a || !b) return false;
    if (a._id && b._id && String(a._id) === String(b._id)) return true;
    if (a.fineId && b.fineId && normalizeFineId(a.fineId) === normalizeFineId(b.fineId)) return true;
    if (a.fineId && b.fineId && fineBaseId(a.fineId) === fineBaseId(b.fineId)) {
        const aSuffix = normalizeFineId(a.fineId).replace(fineBaseId(a.fineId), '');
        const bSuffix = normalizeFineId(b.fineId).replace(fineBaseId(b.fineId), '');
        return !aSuffix || !bSuffix || aSuffix === bSuffix;
    }
    return false;
}

/** One DB record per _id — prefer the most specific fineId (with party suffix). */
export function dedupeEmployeeFines(fines = []) {
    const byKey = new Map();

    fines.forEach((fine) => {
        const key = fine._id ? String(fine._id) : fineBaseId(fine.fineId) || normalizeFineId(fine.fineId);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, fine);
            return;
        }
        const existingId = normalizeFineId(existing.fineId || '');
        const nextId = normalizeFineId(fine.fineId || '');
        if (nextId.length > existingId.length) {
            byKey.set(key, fine);
        }
    });

    return [...byKey.values()];
}

function partyDedupeScore(fine, employeeId) {
    let score = 0;
    const fid = normalizeFineId(fine.fineId || '');
    if (/VEGA-FINE-\d+-[A-Z0-9]+$/i.test(fid)) score += 100;

    const humanAssignees = (fine.assignedEmployees || []).filter(
        (ae) => ae.employeeId && ae.employeeId !== 'VEGA-HR-0000' && ae.employeeId !== 'PENDING',
    );
    if (humanAssignees.length === 1 && humanAssignees[0]?.employeeId === employeeId) score += 50;

    const entry = fine.assignedEmployees?.find((ae) => ae.employeeId === employeeId);
    if (entry?.individualAmount != null && parseFloat(entry.individualAmount) > 0) score += 25;

    if (!/VEGA-FINE-\d+-[A-Z0-9]+$/i.test(fid)) score -= 10;
    return score;
}

/**
 * One liable party per base fine — avoids counting both parent group record and split child.
 */
export function dedupeEmployeeFinesByParty(fines = [], employeeId) {
    const byParty = new Map();

    fines.forEach((fine) => {
        if (!employeeAssignedToFine(fine, employeeId)) return;
        const base = fineBaseId(fine.fineId);
        if (!base) return;

        const key = `${base}:${employeeId}`;
        const existing = byParty.get(key);
        if (!existing || partyDedupeScore(fine, employeeId) > partyDedupeScore(existing, employeeId)) {
            byParty.set(key, fine);
        }
    });

    return [...byParty.values()];
}

export function employeeAssignedToFine(fine, employeeId) {
    if (!fine || !employeeId) return false;
    return (fine.assignedEmployees || []).some(
        (ae) => ae.employeeId === employeeId && ae.employeeId !== 'VEGA-HR-0000',
    );
}

export function resolveEmployeeFinePaidAmount(fine, employeeId, shareAmount) {
    const share = shareAmount ?? resolveEmployeeFinePayableAmount(fine, employeeId);
    if (share <= 0) return 0;

    const entry = (fine.assignedEmployees || []).find((ae) => ae.employeeId === employeeId);
    const paid = parseFloat(entry?.paidAmount ?? fine.paidAmount ?? 0) || 0;
    return Math.min(paid, share);
}

/** Approved fines only for this employee — excludes pending/draft/rejected. */
export function filterApprovedEmployeeFines(allFines = [], employeeId) {
    if (!employeeId) return [];

    return dedupeEmployeeFinesByParty(allFines, employeeId).filter(
        (f) =>
            APPROVED_FINE_STATUSES.includes(f.fineStatus) &&
            employeeAssignedToFine(f, employeeId),
    );
}

export function buildPaymentAggregates(approvedFines, employeeId) {
    const aggregates = emptyAggregates();

    approvedFines.forEach((f) => {
        const share = resolveEmployeeFinePayableAmount(f, employeeId);
        if (share <= 0) return;

        const cat = categorizeEmployeeFine(f);
        aggregates[cat].amount += share;
        aggregates[cat].paid += resolveEmployeeFinePaidAmount(f, employeeId, share);
        aggregates[cat].count += 1;
        aggregates[cat].duration += parseInt(f.payableDuration, 10) || 1;
    });

    return aggregates;
}

export function sumAggregateOutstanding(aggregates) {
    return CATEGORY_KEYS.reduce((sum, key) => {
        const agg = aggregates[key] || {};
        const amount = parseFloat(agg.amount) || 0;
        const paid = parseFloat(agg.paid) || 0;
        return sum + Math.max(0, amount - paid);
    }, 0);
}

export function buildEmployeeOutstandingBalance(aggregates, loanSummary = {}) {
    const advance = loanSummary.salaryAdvance || { amount: 0, paid: 0 };
    const loan = loanSummary.personalLoan || { amount: 0, paid: 0 };

    return (
        sumAggregateOutstanding(aggregates) +
        Math.max(0, (parseFloat(advance.amount) || 0) - (parseFloat(advance.paid) || 0)) +
        Math.max(0, (parseFloat(loan.amount) || 0) - (parseFloat(loan.paid) || 0))
    );
}

export function buildEmployeeFinancials({
    allEmployeeFines = [],
    employeeId,
    loanSummary = {},
}) {
    const approvedFines = filterApprovedEmployeeFines(allEmployeeFines, employeeId);
    const aggregates = buildPaymentAggregates(approvedFines, employeeId);
    const outstandingBalance = buildEmployeeOutstandingBalance(aggregates, loanSummary);
    const totalAmount = CATEGORY_KEYS.reduce(
        (sum, key) => sum + (parseFloat(aggregates[key]?.amount) || 0),
        0,
    );
    const paidFineAmount = CATEGORY_KEYS.reduce(
        (sum, key) => sum + (parseFloat(aggregates[key]?.paid) || 0),
        0,
    );

    return {
        employeeId,
        approvedFines,
        aggregates,
        outstandingBalance,
        totalFineCount: approvedFines.length,
        totalAmount,
        paidFineAmount,
    };
}
