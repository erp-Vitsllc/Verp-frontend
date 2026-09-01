/** User-facing payroll status: Pending → Pending Accounts → Pending HR → Pending Management → Approved. */
export function payrollApprovalStatusLabel(dmf) {
    if (dmf?.statusLabel) return String(dmf.statusLabel);
    const status = String(dmf?.status || '').toLowerCase();
    if (status === 'approved') return 'Approved';
    if (status === 'pending') {
        const key = String(dmf?.currentStepKey || '').toLowerCase();
        const step = (Array.isArray(dmf?.steps) ? dmf.steps : []).find(
            (row) => row.status === 'pending' || String(row.key || '').toLowerCase() === key,
        );
        const fromKey = String(step?.key || key).toLowerCase();
        if (fromKey === 'hr') return 'Pending HR';
        if (fromKey === 'management') return 'Pending Management';
        if (fromKey === 'user1') return `Pending ${step?.label || 'User'}`;
        return 'Pending Accounts';
    }
    return 'Pending';
}
