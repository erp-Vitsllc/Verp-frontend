const PUNCH_KEYS = new Set(['not_marked', 'late_arrived', 'early_go', 'mispunch']);

/** Label shown beside the calendar day status. */
export function dayApprovalLabel(record) {
    if (!record) return '';
    const key = String(record.statusKey || '');
    if (key === 'on_office' || key === 'work_from_home' || key === 'authorized_leave' || key === 'unauthorized_leave') return '';
    const leaveDecision = String(record.leaveRequestStatus || '').trim().toLowerCase();
    const hourDecision = String(record.hourAdjustStatus || '').trim().toLowerCase();
    const appliedLeave = key === 'on_leave' || key === 'sick_leave' || key === 'compoff_leave';
    // A manual sick, annual, or comp-off mark is saved with approvalStatus pending.
    // The day status is the approval. An open leave request on that day is not.
    if (appliedLeave && leaveDecision !== 'pending') return 'Approved';
    // A late, early, or missed punch stays unauthorized until that punch is approved.
    // Overtime approval and the generic attendance flag do not approve the deduction.
    if (PUNCH_KEYS.has(key)) {
        if (leaveDecision === 'pending' || hourDecision === 'pending' || leaveDecision === 'rejected' || hourDecision === 'rejected') {
            return 'Not approved';
        }
        if (hourDecision === 'approved') return 'Approved';
        return 'Not approved';
    }
    const marks = [
        record.hourAdjustStatus,
        record.leaveRequestStatus,
        record.flexibleOtStatus,
        record.approvalStatus,
    ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
    if (marks.includes('approved')) return 'Approved';
    if (marks.some((value) => value === 'pending' || value === 'rejected')) return 'Not approved';
    if (appliedLeave) return 'Approved';
    return '';
}
