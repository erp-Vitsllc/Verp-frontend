import { buildGroupMembersForFine } from '@/utils/fineGroupClassification';

function mapPartyPayables(parties) {
    return (Array.isArray(parties) ? parties : []).map((p) => ({
        fineRecordId: p.fineRecordId,
        fineId: p.fineId,
        employeeName: p.employeeName,
        isCompany: Boolean(p.isCompany),
        expenseAccountId: p.expenseAccountId || '',
        expenseAccountName: p.expenseAccountName || '',
        payableConfirmed: Boolean(p.payableConfirmed || p.expenseAccountId),
    }));
}

function partyMatchKey(party) {
    const record = String(party?.fineRecordId || party?.fineId || '').trim();
    const name = String(party?.employeeName || '').trim().toLowerCase();
    const company = party?.isCompany ? 'company' : 'employee';
    return `${record}::${company}::${name}`;
}

/** Keep a selected payable. If that copy has no account id, use the one saved on the fine. */
function mergeBlankPayablesFromSaved(rows, savedRows) {
    const savedByKey = new Map();
    (savedRows || []).forEach((row, idx) => {
        savedByKey.set(partyMatchKey(row), row);
        savedByKey.set(`idx::${idx}`, row);
    });

    return (rows || []).map((row, idx) => {
        if (String(row.expenseAccountId || '').trim()) return row;
        const saved = savedByKey.get(partyMatchKey(row)) || savedByKey.get(`idx::${idx}`);
        const savedId = String(saved?.expenseAccountId || '').trim();
        if (!savedId) return row;
        return {
            ...row,
            expenseAccountId: savedId,
            expenseAccountName: row.expenseAccountName || saved.expenseAccountName || '',
            payableConfirmed: Boolean(row.payableConfirmed || saved.payableConfirmed || savedId),
        };
    });
}

/**
 * Enter in Zoho is allowed only when Fine Parties has Vendor and every Payable filled.
 */
export function resolveFinePartiesZohoGate(fine, partyPayables) {
    const vendorId = String(fine?.zohoVendorId || '').trim();
    const vendorName = String(fine?.zohoVendorName || fine?.fineSource || '').trim();
    const vendorOk = Boolean(vendorId || vendorName);

    const savedParties = mapPartyPayables(buildGroupMembersForFine(fine));
    const parentParties =
        Array.isArray(partyPayables) && partyPayables.length > 0
            ? mapPartyPayables(partyPayables)
            : [];
    const parties = parentParties.length
        ? mergeBlankPayablesFromSaved(parentParties, savedParties)
        : savedParties;

    const missingPayable = parties.filter((p) => !String(p.expenseAccountId || '').trim());
    const payableOk =
        parties.length > 0
            ? missingPayable.length === 0
            : Boolean(String(fine?.expenseAccountId || '').trim());

    const firstPayable = parties.find((p) => String(p.expenseAccountId || '').trim()) || {};

    return {
        vendorOk,
        payableOk,
        ready: vendorOk && payableOk,
        vendorId,
        vendorName,
        parties,
        missingPayableNames: missingPayable
            .map((p) => p.employeeName || p.fineId)
            .filter(Boolean),
        expenseAccountId: firstPayable.expenseAccountId || fine?.expenseAccountId || '',
        expenseAccountName: firstPayable.expenseAccountName || fine?.expenseAccountName || '',
    };
}
