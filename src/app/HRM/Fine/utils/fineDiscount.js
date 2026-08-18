export function parseFineMoney(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

/** Subtract discount from an amount that already represents the pre-discount total. */
export function applyFineDiscount(amount, discount = 0) {
    return Math.max(0, Number((parseFineMoney(amount) - parseFineMoney(discount)).toFixed(2)));
}

export function validateFineDiscount(discount, maxAmount) {
    if (discount === '' || discount == null) return '';
    const disc = parseFineMoney(discount);
    if (disc < 0) return 'Discount cannot be negative';
    if (maxAmount != null && disc > parseFineMoney(maxAmount) + 0.001) {
        return 'Discount cannot exceed the fine amount';
    }
    return '';
}
