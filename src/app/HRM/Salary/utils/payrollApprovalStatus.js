/** Who the month/DMF is waiting on (name and/or role). */
export function payrollPendingForLabel(dmf) {
    const fromApi = String(dmf?.pendingFor || '').trim();
    if (fromApi) return fromApi;
    if (String(dmf?.status || '').toLowerCase() !== 'pending') return '';
    const key = String(dmf?.currentStepKey || '').toLowerCase();
    const step = (Array.isArray(dmf?.steps) ? dmf.steps : []).find(
        (row) => row.status === 'pending' || String(row.key || '').toLowerCase() === key,
    );
    const name = String(step?.assignedToName || '').trim();
    const label = String(step?.label || step?.role || '').trim();
    if (name && label) return `${name} (${label})`;
    if (name) return name;
    if (label) return label;
    const fromKey = String(step?.key || key).toLowerCase();
    if (fromKey === 'hr') return 'HR';
    if (fromKey === 'management') return 'Management';
    if (fromKey === 'user1') return step?.label || 'User';
    if (fromKey === 'accounts') return 'Accounts';
    return '';
}

/** Month process status: Pending → Pending for Accounts → Pending for HR → Pending for Management → Processed. */
export function monthPayrollProcessStatusLabel(dmf) {
    const status = String(dmf?.status || '').toLowerCase();
    if (status === 'approved') return 'Processed';
    return payrollApprovalStatusLabel(dmf);
}

/** User-facing payroll status: Pending → Pending for Accounts → Pending for HR → Pending for Management → Approved. */
export function payrollApprovalStatusLabel(dmf) {
    if (dmf?.statusLabel) return String(dmf.statusLabel);
    const status = String(dmf?.status || '').toLowerCase();
    if (status === 'approved') return 'Approved';
    if (status === 'pending') {
        const who = payrollPendingForLabel(dmf);
        return who ? `Pending for ${who}` : 'Pending';
    }
    return 'Pending';
}
