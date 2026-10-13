function money2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function deductFraction(deduct) {
    const key = String(deduct || '').trim().toLowerCase();
    if (key === 'full') return 1;
    if (key === 'half') return 0.5;
    if (key === 'quarter') return 0.25;
    return 0;
}

function isMispunchTitle(title) {
    return /miss(?:ed)?[\s-]*punch|mis[\s-]*punch/i.test(String(title || ''));
}

/** Group missed-punch field wins. An older extra rule titled Missed punch still applies until that field is set. */
export function mispunchPolicyRule(policy) {
    const dedicated = policy?.missedPunchRule;
    if (deductFraction(dedicated?.deduct)) return dedicated;
    const extra = (Array.isArray(policy?.extraLateRules) ? policy.extraLateRules : []).find(
        (row) => isMispunchTitle(row?.title) && deductFraction(row?.deduct),
    );
    return extra || null;
}

function chargeableBundles(count, events) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const per = Number(events);
    if (!Number.isFinite(per) || per <= 0) return total;
    if (total <= per) return 0;
    return Math.floor((total - 1) / per);
}

function policyTotal(daily, count, rule) {
    const fraction = deductFraction(rule?.deduct);
    if (!fraction) return 0;
    return money2((Number(daily) || 0) * fraction * chargeableBundles(count, rule?.events));
}

/**
 * One amount per missed-punch date, from the salary-policy missed punch rule only.
 * A free event count deducts nothing. The next punch deducts full, half, or quarter of one day.
 * Unauthorized leave days are not applied.
 */
export function mispunchDayAmounts(records, policy, daily) {
    const rule = mispunchPolicyRule(policy);
    const byMonth = new Map();
    (records || []).forEach((row) => {
        const date = String(row?.date || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const month = date.slice(0, 7);
        if (!byMonth.has(month)) byMonth.set(month, []);
        const dates = byMonth.get(month);
        if (!dates.includes(date)) dates.push(date);
    });
    const amounts = new Map();
    for (const dates of byMonth.values()) {
        dates.sort();
        dates.forEach((date, index) => {
            const count = index + 1;
            const before = rule ? policyTotal(daily, count - 1, rule) : 0;
            const after = rule ? policyTotal(daily, count, rule) : 0;
            amounts.set(date, money2(after - before));
        });
    }
    return amounts;
}
