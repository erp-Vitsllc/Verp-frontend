export const DUPLICATE_BILL_MESSAGES = {
    zoho: 'This bill has already been added for this vendor in Zoho.',
    pending: 'This bill is already pending for this vendor.',
    modal: 'This bill has already been added for this vendor in the current bill.',
};

export function vendorBillKey(vendor, billNumber) {
    const v = String(vendor || '').trim().toLowerCase();
    const n = String(billNumber || '').trim().toLowerCase();
    if (!v || !n) return '';
    return `${v}::${n}`;
}

function isPendingUtilityBill(bill) {
    const status = String(bill?.status || '').trim();
    return status === 'Pending Accounts' || status === 'Pending HR';
}

function billIdentity(bill) {
    return String(bill?._id || bill?.billId || bill?.id || '').trim();
}

/**
 * Immediate local check: current modal rows, then pending bills already loaded.
 * Zoho is confirmed by the API.
 */
export function findLocalVendorBillDuplicate({
    vendor,
    billNumber,
    rowIndex,
    modalRows = [],
    pendingBills = [],
    excludeBillIds = [],
}) {
    const key = vendorBillKey(vendor, billNumber);
    if (!key) return { source: null, message: '' };

    const exclude = new Set((excludeBillIds || []).map((id) => String(id || '').trim()).filter(Boolean));

    const modalMatch = (modalRows || []).some((row, index) => {
        if (index === rowIndex) return false;
        if (row?.selected === false) return false;
        return vendorBillKey(row?.provider, row?.billNumber) === key;
    });
    if (modalMatch) {
        return { source: 'modal', message: DUPLICATE_BILL_MESSAGES.modal };
    }

    const pendingMatch = (pendingBills || []).some((bill) => {
        if (!isPendingUtilityBill(bill)) return false;
        const id = billIdentity(bill);
        if (id && exclude.has(id)) return false;
        return vendorBillKey(bill?.provider, bill?.billNumber) === key;
    });
    if (pendingMatch) {
        return { source: 'pending', message: DUPLICATE_BILL_MESSAGES.pending };
    }

    return { source: null, message: '' };
}
