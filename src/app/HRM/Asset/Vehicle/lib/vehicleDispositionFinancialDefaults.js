/** Registration card fee stored in the registration document JSON description. */
export function parseRegistrationFeeFromAsset(asset) {
    const registrationDoc = (asset?.documents || []).find(
        (d) => String(d?.type || '').toLowerCase() === 'registration',
    );
    if (!registrationDoc?.description) return null;
    try {
        const parsed = JSON.parse(registrationDoc.description);
        const fee = parsed?.fee;
        if (fee == null || fee === '') return null;
        const n = Number(fee);
        return Number.isFinite(n) ? Math.round(n) : null;
    } catch {
        return null;
    }
}

/** Loan principal from mortgage tab (saved loanAmount, or vehicle value − down payment). */
export function resolveMortgageLoanAmount(asset) {
    if (asset?.loanAmount != null && asset.loanAmount !== '' && Number.isFinite(Number(asset.loanAmount))) {
        return Math.max(0, Math.round(Number(asset.loanAmount)));
    }
    const vehicleValue = Number(asset?.mortgageAmount ?? asset?.assetValue ?? 0);
    const down = Number(asset?.downPayment ?? 0);
    if (vehicleValue > 0) {
        return Math.max(0, Math.round(vehicleValue - down));
    }
    if (asset?.balancePayment != null && asset.balancePayment !== '' && Number(asset.balancePayment) > 0) {
        return Math.round(Number(asset.balancePayment));
    }
    return 0;
}

/** Current loan for Sold / disposition: saved field, else mortgage loan amount. */
export function getDefaultCurrentLoanAmount(asset) {
    if (asset?.currentLoanAmount != null && asset.currentLoanAmount !== '') {
        const n = Number(asset.currentLoanAmount);
        if (Number.isFinite(n)) return String(Math.round(n));
    }
    const fromMortgage = resolveMortgageLoanAmount(asset);
    return fromMortgage > 0 ? String(fromMortgage) : '';
}

/** Registration expense defaults to saved value, else registration card fee. */
export function getDefaultRegistrationExpense(asset) {
    if (asset?.registrationExpense != null && asset.registrationExpense !== '') {
        const n = Number(asset.registrationExpense);
        if (Number.isFinite(n)) return String(Math.round(n));
    }
    const fee = parseRegistrationFeeFromAsset(asset);
    return fee != null ? String(fee) : '';
}

export function loanAmountFromMortgage(asset) {
    return getDefaultCurrentLoanAmount(asset);
}

export function registrationExpenseFromCard(asset) {
    return getDefaultRegistrationExpense(asset);
}
