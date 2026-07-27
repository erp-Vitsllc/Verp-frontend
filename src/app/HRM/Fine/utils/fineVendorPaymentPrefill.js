/**
 * Build Payments Made prefill for an approved fine with a Zoho vendor bill.
 */
export function buildFineVendorPaymentPrefill(fine, { returnTo = '' } = {}) {
    if (!fine) return null;

    const amount = Number(fine.fineAmount ?? fine.totalFineAmount ?? 0);
    const zohoBillId = String(fine.zohoBillId || '').trim();
    const vendorId = String(fine.zohoVendorId || '').trim();
    const vendorName = String(fine.zohoVendorName || '').trim();
    const organizationId = String(fine.zohoOrganizationId || '').trim();
    const companyId = String(fine.company?._id || fine.company || '').trim();
    const fineMongoId = String(fine._id || '').trim();
    const fineId = String(fine.fineId || '').trim();
    const today = new Date().toISOString().slice(0, 10);

    return {
        mode: 'fine_bills',
        billsOnly: true,
        vendorId,
        vendorName,
        amount: amount > 0 ? Number(amount).toFixed(2) : '',
        date: String(fine.billDate || '').trim() || today,
        referenceNumber: fineId,
        notes: `Fine vendor payment · ${fineId} · ${String(fine.fineType || '').trim()}`.trim(),
        selectedBillIds: zohoBillId ? [zohoBillId] : [],
        zohoBillIds: zohoBillId ? [zohoBillId] : [],
        fineMongoId,
        fineMongoIds: fineMongoId ? [fineMongoId] : [],
        fineId,
        fineBillLinks: [
            {
                fineMongoId,
                fineId,
                zohoBillId,
                billNumber: String(fine.billNumber || fineId).trim(),
            },
        ],
        organizationId,
        companyId,
        returnTo,
    };
}

export function canAccountsPayFineVendorBill(fine, user, flowchartRows = []) {
    if (!fine || !user) return false;
    const status = String(fine.fineStatus || '');
    if (status !== 'Approved' && status !== 'Active') return false;
    if (String(fine.vendorBillStatus || '').toLowerCase() === 'paid') return false;
    if (!String(fine.zohoBillId || '').trim()) return false;

    return isAccountsFinanceUser(user, flowchartRows) || matchesAccountsHod(fine, user);
}

/** True when the viewer holds the Active Accounts row in Settings > FlowChart. */
export function isActiveFlowchartAccountsUser(user, flowchartRows = []) {
    if (!user || !Array.isArray(flowchartRows) || flowchartRows.length === 0) return false;

    const actualId = user._id || user.id || user.employeeObjectId;
    const empCode = user.employeeId != null ? String(user.employeeId) : '';
    const empObjectId = user.employeeObjectId != null ? String(user.employeeObjectId) : '';

    return flowchartRows.some((row) => {
        const category = String(row?.category || '').toLowerCase().replace(/\s+/g, '');
        const status = String(row?.status || '').toLowerCase();
        if (status !== 'active') return false;
        if (category !== 'accounts' && category !== 'finance') return false;

        const rowObjectId = row?.empObjectId?._id ?? row?.empObjectId;
        return (
            (actualId && String(rowObjectId) === String(actualId)) ||
            (empCode && String(row?.employeeId) === empCode) ||
            (empObjectId && String(row?.employeeId) === empObjectId)
        );
    });
}

/**
 * Accounts may collect employee/company fine share while status stays Approved (Zoho Bill ≠ Paid).
 * The session user carries no department/designation, so the flowchart Accounts row is the reliable signal.
 */
export function isAccountsFinanceUser(user, flowchartRows = []) {
    if (!user) return false;
    if (user.isAdmin || user.role === 'admin' || user.isSystemSuperUser) return true;
    if (isActiveFlowchartAccountsUser(user, flowchartRows)) return true;
    const dept = String(user.department || '').toLowerCase();
    const designation = String(user.designation || '').toLowerCase();
    if (dept.includes('finance') || dept.includes('account') || dept.includes('payroll')) return true;
    if (designation.includes('account') || designation.includes('finance') || designation.includes('payroll')) {
        return true;
    }
    return false;
}

function matchesAccountsHod(fine, user) {
    const accountsEmpId = String(fine?.accountsHODId || '').trim();
    const userEmpId = String(user?.employeeId || '').trim();
    return Boolean(accountsEmpId && userEmpId && accountsEmpId === userEmpId);
}

export function canAccountsPayFineEmployeeShare(fine, user, balance = null, flowchartRows = []) {
    if (!fine || !user) return false;
    const status = String(fine.fineStatus || '');
    if (status !== 'Approved' && status !== 'Active') return false;
    const bal =
        balance == null
            ? Math.max(
                  0,
                  (Number(fine.totalFineAmount || fine.fineAmount || 0) || 0) -
                      (Number(fine.paidAmount || 0) || 0),
              )
            : Number(balance) || 0;
    if (bal <= 0.01) return false;
    return isAccountsFinanceUser(user, flowchartRows) || matchesAccountsHod(fine, user);
}
