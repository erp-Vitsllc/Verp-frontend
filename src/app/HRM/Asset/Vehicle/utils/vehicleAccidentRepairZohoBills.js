/**
 * Accident Repair Make Payment — auto Zoho Bill cards from cost lines
 * (Insurance Excess, Police Fine, Other Fine rows) with equalized payables.
 */

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function newBillId(suffix = '') {
    return `acc-bill-${suffix || Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Cost line items that become Zoho Bill cards (amount > 0 only).
 */
export function resolveAccidentRepairCostBillSources(remark = {}) {
    const sources = [];
    const insurance = money(remark.insuranceFineAmount);
    if (insurance > 0) {
        sources.push({
            key: 'insurance_excess',
            label: 'Insurance Excess',
            amount: insurance,
        });
    }

    const police = money(remark.policeFineAmount);
    if (police > 0) {
        sources.push({
            key: 'police_fine',
            label: 'Police Fine',
            amount: police,
        });
    }

    const otherRows = Array.isArray(remark.otherFineRows) ? remark.otherFineRows : [];
    if (otherRows.length) {
        otherRows.forEach((row, index) => {
            const amount = money(row?.amount);
            if (!(amount > 0)) return;
            const name = String(row?.name || '').trim() || `Other Fine ${index + 1}`;
            sources.push({
                key: `other_fine_${index}`,
                label: name,
                amount,
            });
        });
    } else {
        const legacyOther = money(remark.otherFineAmount);
        if (legacyOther > 0) {
            sources.push({
                key: 'other_fine',
                label: 'Other Fine',
                amount: legacyOther,
            });
        }
    }

    return sources;
}

export function sumAccidentRepairCostBillSources(sources = []) {
    return (sources || []).reduce((sum, row) => sum + money(row?.amount), 0);
}

/**
 * Split `total` across party weights so amounts sum exactly to total.
 * Weights come from HR company/employee payable amounts.
 */
export function equalizeAmountsByWeights(weights = [], total) {
    const target = roundMoney(total);
    const safeWeights = (weights || []).map((w) => Math.max(0, money(w)));
    const weightSum = safeWeights.reduce((s, w) => s + w, 0);
    if (!(target > 0) || !safeWeights.length) {
        return safeWeights.map(() => 0);
    }
    if (!(weightSum > 0)) {
        // Equal split across parties
        const n = safeWeights.length;
        const base = roundMoney(target / n);
        const amounts = safeWeights.map((_, i) => (i === n - 1 ? 0 : base));
        const allocated = amounts.slice(0, -1).reduce((s, a) => s + a, 0);
        amounts[n - 1] = roundMoney(target - allocated);
        return amounts;
    }

    const amounts = safeWeights.map((w) => roundMoney((target * w) / weightSum));
    const allocated = amounts.reduce((s, a) => s + a, 0);
    const drift = roundMoney(target - allocated);
    if (drift !== 0 && amounts.length) {
        // Put rounding remainder on the largest weight line
        let maxIdx = 0;
        for (let i = 1; i < safeWeights.length; i += 1) {
            if (safeWeights[i] > safeWeights[maxIdx]) maxIdx = i;
        }
        amounts[maxIdx] = roundMoney(amounts[maxIdx] + drift);
    }
    return amounts;
}

/**
 * Party template from HR/Initiate payables (same parties on every bill).
 * Returns { partyType, partyName, description, employeeId?, weight }.
 */
export function buildAccidentPayablePartyTemplate(payableLines = []) {
    return (Array.isArray(payableLines) ? payableLines : [])
        .map((row) => {
            const weight = money(row?.amount);
            const partyName = String(row?.partyName || row?.description || '').trim();
            if (!partyName && !row?.employeeId && weight <= 0) return null;
            return {
                partyType: String(row?.partyType || '').trim() || undefined,
                partyName: partyName || (row?.partyType === 'employee' ? 'Employee' : 'Company'),
                description: partyName || String(row?.description || '').trim(),
                employeeId: String(row?.employeeId || '').trim() || undefined,
                payableTo: String(row?.payableTo || '').trim(),
                payAccountId: String(row?.payAccountId || '').trim(),
                weight: weight > 0 ? weight : 0,
            };
        })
        .filter(Boolean);
}

export function buildEqualizedPayablesForBillAmount(partyTemplate = [], billAmount) {
    const template = Array.isArray(partyTemplate) ? partyTemplate : [];
    if (!template.length) {
        return [
            {
                partyType: 'company',
                partyName: 'Company',
                description: 'Company',
                payableTo: '',
                payAccountId: '',
                amount: billAmount > 0 ? String(roundMoney(billAmount)) : '',
            },
        ];
    }
    const weights = template.map((p) => p.weight);
    const amounts = equalizeAmountsByWeights(weights, billAmount);
    return template.map((party, index) => ({
        partyType: party.partyType,
        partyName: party.partyName,
        description: party.description || party.partyName,
        employeeId: party.employeeId,
        payableTo: party.payableTo || '',
        payAccountId: party.payAccountId || '',
        amount: amounts[index] > 0 ? String(amounts[index]) : '0',
    }));
}

function billPayablesSum(lines = []) {
    return roundMoney((lines || []).reduce((sum, row) => sum + money(row?.amount), 0));
}

/**
 * Prefer saved multi-bills once Accounts committed Chart of Accounts;
 * otherwise rebuild from cost lines + equalized payables.
 */
export function buildAccidentRepairAutoZohoBills({
    service,
    remark = {},
    payableTemplateLines = [],
    garageName = '',
    zohoVendorId = '',
    existingAttachmentUrl = '',
    existingAttachmentName = '',
} = {}) {
    const sources = resolveAccidentRepairCostBillSources(remark);
    const partyTemplate = buildAccidentPayablePartyTemplate(payableTemplateLines);

    const saved = Array.isArray(remark.zohoBills) ? remark.zohoBills : [];
    const savedCommitted = saved.some((bill) =>
        (Array.isArray(bill?.billingPayables) ? bill.billingPayables : []).some((row) =>
            String(row?.payAccountId || '').trim(),
        ),
    );

    // Restore saved bills if they match cost keys / count and CoA was started.
    if (savedCommitted && saved.length) {
        return saved.map((row, index) => {
            const source =
                sources.find((s) => s.key === row.costKey) ||
                sources[index] ||
                null;
            const fixedAmount = money(row.billingTotalAmount || row.garageBillAmount || source?.amount);
            return {
                id: String(row.id || '').trim() || newBillId(source?.key || String(index + 1)),
                costKey: String(row.costKey || source?.key || '').trim(),
                costLabel: String(row.costLabel || source?.label || `Zoho Bill #${index + 1}`).trim(),
                autoGenerated: true,
                garageName: String(row.garageName || row.vendorName || garageName || '').trim(),
                zohoVendorId: String(row.zohoVendorId || zohoVendorId || '').trim(),
                garageBillAmount: fixedAmount > 0 ? String(fixedAmount) : '',
                payAccountId: String(row.payAccountId || '').trim(),
                payAccountName: String(row.payAccountName || '').trim(),
                garageAttachment: null,
                existingGarageAttachmentUrl: String(
                    row.garageAttachmentUrl || row.garageBillAttachmentUrl || existingAttachmentUrl || '',
                ).trim(),
                existingGarageAttachmentName: String(
                    row.garageAttachmentName || existingAttachmentName || '',
                ).trim(),
                billingPayables: Array.isArray(row.billingPayables) && row.billingPayables.length
                    ? row.billingPayables.map((line) => ({
                          partyType: String(line?.partyType || '').trim(),
                          partyName: String(line?.partyName || line?.description || '').trim(),
                          description: String(line?.description || line?.partyName || '').trim(),
                          employeeId: String(line?.employeeId || '').trim() || undefined,
                          payableTo: String(line?.payableTo || line?.payAccountName || '').trim(),
                          payAccountId: String(line?.payAccountId || line?.accountId || '').trim(),
                          amount:
                              line?.amount != null && line?.amount !== ''
                                  ? String(line.amount)
                                  : '',
                      }))
                    : buildEqualizedPayablesForBillAmount(partyTemplate, fixedAmount),
                zohoBillId: String(row.zohoBillId || '').trim(),
                zohoBillNumber: String(row.zohoBillNumber || '').trim(),
                zohoSyncError: String(row.zohoSyncError || '').trim(),
            };
        });
    }

    if (!sources.length) {
        // Fallback: one bill from overall total if cost lines missing.
        const fallbackAmount =
            money(remark.billingTotalAmount) ||
            money(remark.estimatedCost) ||
            money(remark.hrReviewApprovedAmount) ||
            money(service?.value) ||
            0;
        return [
            {
                id: newBillId('total'),
                costKey: 'total',
                costLabel: 'Accident Repair Total',
                autoGenerated: true,
                garageName: String(garageName || remark.garageName || remark.vendorName || '').trim(),
                zohoVendorId: String(zohoVendorId || remark.zohoVendorId || '').trim(),
                garageBillAmount: fallbackAmount > 0 ? String(fallbackAmount) : '',
                payAccountId: '',
                payAccountName: '',
                garageAttachment: null,
                existingGarageAttachmentUrl: String(existingAttachmentUrl || '').trim(),
                existingGarageAttachmentName: String(existingAttachmentName || '').trim(),
                billingPayables: buildEqualizedPayablesForBillAmount(partyTemplate, fallbackAmount),
                zohoBillId: '',
                zohoBillNumber: '',
                zohoSyncError: '',
            },
        ];
    }

    return sources.map((source) => ({
        id: newBillId(source.key),
        costKey: source.key,
        costLabel: source.label,
        autoGenerated: true,
        garageName: String(garageName || remark.garageName || remark.vendorName || '').trim(),
        zohoVendorId: String(zohoVendorId || remark.zohoVendorId || '').trim(),
        garageBillAmount: String(roundMoney(source.amount)),
        payAccountId: '',
        payAccountName: '',
        garageAttachment: null,
        existingGarageAttachmentUrl: String(existingAttachmentUrl || '').trim(),
        existingGarageAttachmentName: String(existingAttachmentName || '').trim(),
        billingPayables: buildEqualizedPayablesForBillAmount(partyTemplate, source.amount),
        zohoBillId: '',
        zohoBillNumber: '',
        zohoSyncError: '',
    }));
}

/**
 * Validate Accident multi-bills before Zoho submit.
 * @returns {string} error message or ''
 */
export function validateAccidentRepairZohoBills(zohoBills = [], remark = {}) {
    const bills = Array.isArray(zohoBills) ? zohoBills : [];
    if (!bills.length) {
        return 'No payment bills to submit. Add Insurance Excess / Police Fine / Other Fine amounts on Initiate.';
    }

    const costSources = resolveAccidentRepairCostBillSources(remark);
    const expectedTotal = sumAccidentRepairCostBillSources(costSources);
    const billsTotal = roundMoney(
        bills.reduce((sum, bill) => sum + money(bill?.garageBillAmount || bill?.billingTotalAmount), 0),
    );

    if (expectedTotal > 0 && Math.abs(billsTotal - expectedTotal) > 0.01) {
        return `All bill totals (AED ${billsTotal.toFixed(2)}) must equal the cost total (AED ${expectedTotal.toFixed(2)}).`;
    }

    for (let i = 0; i < bills.length; i += 1) {
        const bill = bills[i];
        const label = String(bill?.costLabel || `Zoho Bill #${i + 1}`).trim();
        if (!String(bill?.garageName || '').trim()) {
            return `${label}: select a garage vendor.`;
        }
        const target = roundMoney(money(bill?.garageBillAmount || bill?.billingTotalAmount));
        if (!(target > 0)) {
            return `${label}: amount must be greater than 0.`;
        }
        const lines = Array.isArray(bill?.billingPayables) ? bill.billingPayables : [];
        if (!lines.length) {
            return `${label}: add payable-from lines.`;
        }
        for (let j = 0; j < lines.length; j += 1) {
            const row = lines[j];
            if (!String(row?.payAccountId || '').trim() || !(money(row?.amount) > 0)) {
                return `${label}: every payable-from line needs Chart of Accounts and amount.`;
            }
        }
        const lineSum = billPayablesSum(lines);
        if (Math.abs(lineSum - target) > 0.01) {
            return `${label}: payable lines (AED ${lineSum.toFixed(2)}) must equal this payment (AED ${target.toFixed(2)}).`;
        }
    }

    return '';
}
