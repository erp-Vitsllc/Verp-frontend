/** Label shown beside the calendar day status. */
export function dayApprovalLabel(record) {
    if (!record) return '';
    const key = String(record.statusKey || '');
    if (key === 'on_office' || key === 'work_from_home' || key === 'authorized_leave' || key === 'unauthorized_leave') return '';
    const leaveDecision = String(record.leaveRequestStatus || '').trim().toLowerCase();
    const appliedLeave = key === 'on_leave' || key === 'sick_leave' || key === 'compoff_leave';
    // A manual sick, annual, or comp-off mark is saved with approvalStatus pending.
    // The day status is the approval. An open leave request on that day is not.
    if (appliedLeave && leaveDecision !== 'pending') return 'Approved';
    const marks = [
        record.hourAdjustStatus,
        record.leaveRequestStatus,
        record.flexibleOtStatus,
        record.approvalStatus,
    ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
    if (marks.includes('approved')) return 'Approved';
    if (marks.some((value) => value === 'pending' || value === 'rejected')) return 'Not approved';
    if (key === 'not_marked' || key === 'late_arrived' || key === 'early_go' || key === 'mispunch') {
        return 'Not approved';
    }
    if (appliedLeave) return 'Approved';
    return '';
}
