/** Parse numeric AED fields from form strings (digits only). */
export function parseMoneyInt(v) {
    const n = Number(String(v ?? '').replace(/\D/g, '') || 0);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Balance in hand: |(loan + registration expense + other expenses) − payout value|.
 * Payout = sold value or total loss value. Always non-negative.
 */
export function computeDispositionBalanceInHand(
    payoutValue,
    currentLoanAmount,
    registrationExpense,
    otherExpense,
) {
    const raw =
        parseMoneyInt(currentLoanAmount) +
        parseMoneyInt(registrationExpense) +
        parseMoneyInt(otherExpense) -
        parseMoneyInt(payoutValue);
    return Math.abs(Math.round(raw));
}

/** @deprecated Use computeDispositionBalanceInHand — same formula with sold value. */
export function computeSoldBalanceInHand(soldValue, currentLoanAmount, registrationExpense, otherExpense) {
    return computeDispositionBalanceInHand(
        soldValue,
        currentLoanAmount,
        registrationExpense,
        otherExpense,
    );
}
