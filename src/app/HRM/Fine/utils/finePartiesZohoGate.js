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

/**
 * Enter in Zoho is allowed only when Fine Parties has Vendor and every Payable filled.
 */
export function resolveFinePartiesZohoGate(fine, partyPayables) {
    const vendorId = String(fine?.zohoVendorId || '').trim();
    const vendorName = String(fine?.zohoVendorName || fine?.fineSource || '').trim();
    const vendorOk = Boolean(vendorId || vendorName);

    const parties =
        Array.isArray(partyPayables) && partyPayables.length > 0
            ? mapPartyPayables(partyPayables)
            : mapPartyPayables(buildGroupMembersForFine(fine));

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
