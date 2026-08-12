/**
 * Schedule / Reschedule submit lifecycle for all vehicle service types:
 * first Submit → Submitted; later Resubmit → Resubmitted (stored on remark).
 */

export const SCHEDULE_SUBMIT_STATUS = {
    SUBMITTED: 'submitted',
    RESUBMITTED: 'resubmitted',
};

export function getScheduleSubmitStatus(remark = {}, workflow = null) {
    const fromRemark = String(remark?.scheduleSubmitStatus || '')
        .trim()
        .toLowerCase();
    if (fromRemark === SCHEDULE_SUBMIT_STATUS.RESUBMITTED) {
        return SCHEDULE_SUBMIT_STATUS.RESUBMITTED;
    }
    if (fromRemark === SCHEDULE_SUBMIT_STATUS.SUBMITTED) {
        return SCHEDULE_SUBMIT_STATUS.SUBMITTED;
    }
    // Legacy fallbacks before scheduleSubmitStatus existed
    if (
        remark?.garageSubmittedByName ||
        workflow?.garageSubmittedAt ||
        String(remark?.requestStatus || '')
            .trim()
            .toLowerCase() === 'submitted' ||
        remark?.assignmentSubmittedAt ||
        remark?.oilServiceScheduledAt
    ) {
        return SCHEDULE_SUBMIT_STATUS.SUBMITTED;
    }
    return '';
}

export function getScheduleSubmitStatusLabel(status) {
    if (status === SCHEDULE_SUBMIT_STATUS.RESUBMITTED) return 'Resubmitted';
    if (status === SCHEDULE_SUBMIT_STATUS.SUBMITTED) return 'Submitted';
    return '';
}

/** Primary action button on Schedule cards. */
export function getScheduleSubmitButtonLabel({ status, saving = false } = {}) {
    const hasSubmitted = Boolean(status);
    if (saving) {
        return hasSubmitted ? 'Resubmitting...' : 'Submitting...';
    }
    return hasSubmitted ? 'Resubmit' : 'Submit';
}
