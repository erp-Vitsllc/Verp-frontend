import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';
import { isEndOfServiceFineSource, resolveFineScheduleDuration } from '@/app/HRM/Fine/utils/fineScheduleUtils';

const TOLERANCE = 0.01;

function parseStartMonth(startMonth) {
    if (!startMonth) return null;

    let startDate;
    if (startMonth.includes('-')) {
        const parts = startMonth.split('-');
        if (parts[0].length === 4) {
            startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        } else {
            startDate = new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 1);
        }
    } else if (startMonth.includes('/')) {
        const parts = startMonth.split('/');
        if (parts[0].length === 4) {
            startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        } else {
            startDate = new Date(parseInt(parts[1], 10), parseInt(parts[0], 10) - 1, 1);
        }
    } else {
        const monthNames = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december',
        ];
        const normalizedStart = startMonth.trim().toLowerCase();
        const monthIndex = monthNames.findIndex((m) => m.startsWith(normalizedStart));

        if (monthIndex !== -1) {
            startDate = new Date();
            startDate.setMonth(monthIndex);
            startDate.setDate(1);
        } else {
            startDate = new Date(startMonth);
            if (Number.isNaN(startDate.getTime())) return null;
            startDate.setDate(1);
        }
    }

    return startDate;
}

function boxStatus(monthlyAmount, paidAmount) {
    const isPaid = paidAmount >= monthlyAmount - TOLERANCE;
    const isPartial = !isPaid && paidAmount > TOLERANCE;
    return {
        isPaid,
        isPartial,
        isNotPaid: !isPaid && !isPartial,
        remaining: Math.max(0, monthlyAmount - paidAmount),
    };
}

function assignPaymentsToMonths(duration, monthlyAmount, payments) {
    const sortedPayments = [...payments].sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.createdAt || 0);
        const dateB = new Date(b.paymentDate || b.createdAt || 0);
        return dateA - dateB;
    });

    const remainingPayments = [...sortedPayments];
    const boxes = [];

    for (let i = 0; i < duration; i += 1) {
        let paidAmount = 0;

        while (remainingPayments.length > 0 && paidAmount < monthlyAmount) {
            const nextPayment = remainingPayments[0];
            const paymentAmount = parseFloat(nextPayment.amount || 0);
            const needed = monthlyAmount - paidAmount;

            if (paymentAmount <= needed) {
                paidAmount += paymentAmount;
                remainingPayments.shift();
            } else {
                paidAmount = monthlyAmount;
                remainingPayments[0] = { ...nextPayment, amount: paymentAmount - needed };
                break;
            }
        }

        boxes.push({ paidAmount });
    }

    return boxes;
}

function buildEosBox(totalAmount, payments) {
    const paidAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount || 0) || 0), 0);
    const cappedPaid = Math.min(paidAmount, totalAmount);
    const status = boxStatus(totalAmount, cappedPaid);

    return [{
        key: 'eos',
        label: 'End of Service',
        monthlyAmount: totalAmount,
        paidAmount: cappedPaid,
        ...status,
        isEos: true,
    }];
}

/**
 * Build installment boxes for a single fine, loan, or advance — same allocation
 * logic as the Accounts payment modal (payments fill months in date order).
 */
function buildEosMonthBoxes(entity, payments, employeeId) {
    const totalAmount = resolveEmployeeFinePayableAmount(entity, employeeId)
        || parseFloat(entity.fineAmount || 0)
        || 0;
    if (totalAmount <= 0) return [];

    const duration = resolveFineScheduleDuration(entity);
    const startDate =
        parseStartMonth(entity.monthStart)
        || parseStartMonth(entity.awardedDate)
        || parseStartMonth(entity.fineDate)
        || parseStartMonth(entity.createdAt);

    if (!startDate) {
        return buildEosBox(totalAmount, payments);
    }

    const monthlyAmount = totalAmount / duration;
    const monthAllocations = assignPaymentsToMonths(duration, monthlyAmount, payments);

    return monthAllocations.map((allocation, index) => {
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + index);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const status = boxStatus(monthlyAmount, allocation.paidAmount);

        return {
            key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
            label: monthLabel,
            monthDate,
            monthlyAmount,
            paidAmount: allocation.paidAmount,
            ...status,
            isEos: true,
        };
    });
}

export function buildEntityPaymentSchedule({
    entityType,
    entity,
    payments = [],
    employeeId,
}) {
    if (!entity) return [];

    if (entityType === 'Fine' && isEndOfServiceFineSource(entity.sourceOfIncome)) {
        return buildEosMonthBoxes(entity, payments, employeeId);
    }

    let duration;
    let startMonth;
    let totalAmount;

    if (entityType === 'Fine') {
        duration = entity.payableDuration || 1;
        startMonth = entity.monthStart || '';
        const employeeShare = resolveEmployeeFinePayableAmount(entity, employeeId);
        totalAmount = employeeShare > 0 ? employeeShare : (parseFloat(entity.fineAmount || 0) || 0);
    } else if (entityType === 'Loan' || entityType === 'Advance') {
        duration = entity.duration || 1;
        startMonth = entity.monthStart || '';
        totalAmount = parseFloat(entity.amount || 0) || 0;
    } else {
        return [];
    }

    if (totalAmount <= 0) return [];

    const startDate = parseStartMonth(startMonth);
    if (!startDate) {
        const paidAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount || 0) || 0), 0);
        const cappedPaid = Math.min(paidAmount, totalAmount);
        const status = boxStatus(totalAmount, cappedPaid);
        return [{
            key: 'lump-sum',
            label: 'Total',
            monthlyAmount: totalAmount,
            paidAmount: cappedPaid,
            ...status,
        }];
    }

    const monthlyAmount = totalAmount / duration;
    const monthAllocations = assignPaymentsToMonths(duration, monthlyAmount, payments);

    return monthAllocations.map((allocation, index) => {
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + index);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const status = boxStatus(monthlyAmount, allocation.paidAmount);

        return {
            key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
            label: monthLabel,
            monthDate,
            monthlyAmount,
            paidAmount: allocation.paidAmount,
            ...status,
        };
    });
}
