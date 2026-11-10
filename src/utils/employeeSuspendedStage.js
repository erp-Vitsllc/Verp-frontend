/** Attendance account stage from Work Details. Suspended employees cannot apply. */
export function isEmployeeSuspendedStage(employee) {
    return String(employee?.attendanceAccountStatus || '').trim().toLowerCase() === 'suspended';
}

export function suspendedApplicationMessage(kind) {
    return `This employee is suspended and cannot apply for ${kind}.`;
}
