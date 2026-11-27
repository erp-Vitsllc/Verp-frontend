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

/** Zoho bill already linked, vendor bill paid in Zoho, or Accounts chose a settlement path. */
export function fineHasZohoBill(fine) {
    if (!fine) return false;
    return Boolean(
        String(fine.zohoBillId || '').trim() || String(fine.zohoBillNumber || '').trim(),
    );
}

/** Completed after Accounts Make Payment (Zoho entry or paid by employee). */
export function isFineAccountsSettlementDone(fine) {
    if (!fine) return false;
    const path = String(fine.accountsPaymentPath || '').trim().toLowerCase();
    if (path === 'zoho' || path === 'employee' || path === 'journal') return true;
    if (String(fine.vendorBillStatus || '').toLowerCase() === 'paid') return true;
    return fineHasZohoBill(fine);
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

function workflowPersonName(person) {
    if (!person || typeof person !== 'object') return '';
    return [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
        || String(person.name || '').trim();
}

/** Employee the open workflow step is waiting on. */
export function fineWorkflowHolderName(fine) {
    const steps = Array.isArray(fine?.workflow) ? fine.workflow : [];
    const pending = steps.find((step) => String(step?.status || '').trim().toLowerCase() === 'pending');
    const fromStep = workflowPersonName(pending?.assignedTo);
    if (fromStep) return formatFineListEmpName(fromStep);
    const fromSubmit = workflowPersonName(fine?.submittedTo);
    if (fromSubmit) return formatFineListEmpName(fromSubmit);
    return '';
}

/** Fine Status cell. Pending names the employee who still has the workflow. */
export function formatFineListStatusLabel(fine) {
    const status = formatFineListStatus(fine);
    if (status !== 'Pending') return status;
    const name = fineWorkflowHolderName(fine);
    return name ? `Pending with ${name}` : 'Pending';
}

export const FINE_LIST_STATUS_FILTERS = [
    { value: 'All', label: 'All Statuses' },
    { value: 'fine-pending', label: 'Fine status pending' },
    { value: 'fine-completed', label: 'Fine status completed' },
    { value: 'vendor-pending', label: 'Vendor payment pending' },
    { value: 'vendor-completed', label: 'Vendor payment completed' },
    { value: 'employee-pending', label: 'Employee payment pending' },
    { value: 'employee-completed', label: 'Employee payment completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'draft', label: 'Draft' },
];

const FINE_LIST_STATUS_FILTER_VALUES = new Set(FINE_LIST_STATUS_FILTERS.map((row) => row.value));

export function normalizeFineListStatusFilter(value) {
    const raw = String(value || 'All').trim();
    if (FINE_LIST_STATUS_FILTER_VALUES.has(raw)) return raw;
    if (raw === 'Pending') return 'fine-pending';
    if (raw === 'Completed') return 'fine-completed';
    if (raw === 'Paid to Vendor') return 'vendor-completed';
    if (raw === 'Cancelled' || raw === 'Withdrawn') return 'cancelled';
    if (raw === 'Draft') return 'draft';
    return 'All';
}

export function matchesFineListStatusFilter(fine, filterKey) {
    const key = normalizeFineListStatusFilter(filterKey);
    if (key === 'All') return true;
    const workflow = formatFineListStatus(fine);
    const stored = String(fine?.fineStatus || '').trim().toLowerCase();
    if (key === 'fine-pending') return workflow === 'Pending' && stored !== 'draft';
    if (key === 'fine-completed') return workflow === 'Completed';
    if (key === 'vendor-pending') return formatFineListVendorPayment(fine) === 'Pending';
    if (key === 'vendor-completed') return formatFineListVendorPayment(fine) === 'Paid';
    if (key === 'employee-pending') return formatFineListAssigneePayment(fine) === 'Pending';
    if (key === 'employee-completed') return formatFineListAssigneePayment(fine) === 'Employee paid';
    if (key === 'cancelled') return workflow === 'Cancelled';
    if (key === 'draft') return stored === 'draft';
    return true;
}

export function formatFineListZohoNo(fine) {
    const zohoNo = resolveZohoDocumentNumber(fine);
    if (zohoNo) return zohoNo;
    if (String(fine?.accountsPaymentPath || '').trim() === 'employee') return 'N/A';
    return '—';
}
