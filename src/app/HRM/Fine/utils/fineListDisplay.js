import { resolveZohoDocumentNumber } from '@/utils/zohoDocumentNumber';
import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';
import { isCompanyFineParty } from '@/utils/fineGroupClassification';

/** First name + first 3 letters of last name (e.g. Raseel Muhammad → Raseel Muh). */
export function formatFineListEmpName(fullName) {
    const text = String(fullName || '').trim();
    if (!text || text === 'N/A') return text || '—';
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${last.slice(0, 3)}`;
}

export function formatFineListCompanyName(fine) {
    const company = fine?.company;
    if (company && typeof company === 'object') {
        const short = String(company.nickName || company.companyShortName || '').trim();
        if (short) return short;
        const name = String(company.name || '').trim();
        if (name) return name;
    }
    return String(fine?.companyShortName || fine?.companyName || '').trim() || 'N/A';
}

function isClosedWorkflowStatus(status) {
    const s = String(status || '').trim().toLowerCase();
    return s === 'rejected' || s === 'cancelled' || s === 'withdrawn';
}

/** Vendor paid via Zoho bill, or employee paid the vendor directly (no Zoho). */
export function isFineVendorSidePaid(fine) {
    if (!fine) return false;
    if (String(fine.vendorBillStatus || '').toLowerCase() === 'paid') return true;
    return String(fine.accountsPaymentPath || '').trim() === 'employee';
}

export function formatFineListVendorPayment(fine) {
    if (!fine) return 'Pending';
    return isFineVendorSidePaid(fine) ? 'Paid' : 'Pending';
}

export function isFineAssigneeEmployeePaid(fine) {
    if (!fine) return false;
    if (isCompanyFineParty(fine) || fine.isCompany || fine.isCompanyOnly) return false;
    if (String(fine.accountsPaymentPath || '').trim() === 'employee') return true;

    const paid = Number(fine.paidAmount || 0) || 0;
    const empShare = resolveEmployeeFinePayableAmount(
        fine,
        fine.employeeId || fine.assignedEmployees?.[0]?.employeeId,
    );
    if (empShare > 0.01 && paid + 0.01 >= empShare) return true;
    if (empShare <= 0.01 && paid > 0.01) return true;

    const status = String(fine.fineStatus || '').trim();
    return status === 'Paid' && String(fine.accountsPaymentPath || '').trim() !== 'zoho';
}

export function formatFineListAssigneePayment(fine) {
    if (!fine) return 'Pending';
    if (fine.isCompany || fine.isCompanyOnly || isCompanyFineParty(fine)) return '—';
    if (fine.isGroup) {
        const members = Array.isArray(fine.groupMembers) ? fine.groupMembers : [];
        const employees = members.filter((m) => !m.isCompany);
        if (!employees.length) return '—';
        const allPaid = employees.every((m) =>
            isFineAssigneeEmployeePaid({
                ...fine,
                ...m,
                isGroup: false,
                isCompany: false,
                isCompanyOnly: false,
            }),
        );
        return allPaid ? 'Employee paid' : 'Pending';
    }
    return isFineAssigneeEmployeePaid(fine) ? 'Employee paid' : 'Pending';
}

/** Completed after Accounts Make Payment (Zoho entry or paid by employee). */
export function isFineAccountsSettlementDone(fine) {
    const path = String(fine?.accountsPaymentPath || '').trim().toLowerCase();
    return path === 'zoho' || path === 'employee';
}

export function isFineListCompleted(fine) {
    if (!fine || isClosedWorkflowStatus(fine.fineStatus)) return false;
    return isFineAccountsSettlementDone(fine);
}

export function formatFineListStatus(fine) {
    const status = String(fine?.fineStatus || '').trim();
    const lower = status.toLowerCase();
    if (lower === 'rejected') return 'Rejected';
    if (lower === 'cancelled' || lower === 'withdrawn') return 'Cancelled';
    return isFineListCompleted(fine) ? 'Completed' : 'Pending';
}

export function formatFineListZohoNo(fine) {
    const zohoNo = resolveZohoDocumentNumber(fine);
    if (zohoNo) return zohoNo;
    if (String(fine?.accountsPaymentPath || '').trim() === 'employee') return 'N/A';
    return '—';
}
