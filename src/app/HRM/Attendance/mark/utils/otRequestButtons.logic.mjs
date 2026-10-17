function wholeHourCount(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours + 1e-9);
}

/** Overtime is added only after approval, or when a next day was set from it. */
export function otWasAdded(mark) {
    if (String(mark?.flexibleOtStatus || '') !== 'approved') return false;
    const approved = Number(mark?.flexibleOtApprovedHours) || 0;
    const nextDay = String(mark?.flexibleOtNextDayDate || '').trim();
    return Boolean(nextDay) || approved > 0;
}

export function otCellLabel(mark) {
    const status = String(mark?.flexibleOtStatus || '');
    const approved = Number(mark?.flexibleOtApprovedHours) || 0;
    const required = Number(mark?.flexibleRequiredHours) || 0;
    const nextDay = String(mark?.flexibleOtNextDayDate || '').trim();
    if (otWasAdded(mark)) {
        if (nextDay || (!required && approved > 10)) return 'Next day';
        return `OT: ${wholeHourCount(approved)} hr`;
    }
    if (status === 'pending') return 'Pending';
    return '';
}

export function overtimePastRequired(workedHours, requiredHours) {
    const worked = Number(workedHours) || 0;
    const required = Number(requiredHours) > 0 ? Number(requiredHours) : 10;
    if (!(worked > 0)) return 0;
    const past = Math.round((worked - required) * 100) / 100;
    return past + 0.001 >= 1 ? past : 0;
}

/**
 * Buttons follow the punches until overtime is added.
 * A rejection, or hours cleared on the record, does not hide them.
 */
export function requestableOvertimeHours(mark, durationHours, requiredHours, { syntheticOt = false } = {}) {
    const status = String(mark?.flexibleOtStatus || '');
    const stored = Number(mark?.flexibleOtHours) || 0;
    if (status === 'pending' || otWasAdded(mark)) return stored;
    if (syntheticOt) return stored > 0 ? stored : 0;
    const required = Number(requiredHours) > 0
        ? Number(requiredHours)
        : Number(mark?.flexibleRequiredHours) || 0;
    const fromSpan = overtimePastRequired(durationHours, required);
    return Math.max(stored, fromSpan);
}

export function markWithRequestableOt(mark, otHours) {
    if (!mark || Number(mark.flexibleOtHours) > 0 || !(Number(otHours) > 0)) return mark;
    return { ...mark, flexibleOtHours: otHours };
}

export function otActionState({
    mark,
    durationHours,
    requiredHours,
    syntheticOt = false,
} = {}) {
    const otText = otCellLabel(mark);
    const otHours = requestableOvertimeHours(mark, durationHours, requiredHours, { syntheticOt });
    const showOtRequest = otHours > 0 && !otText;
    // A midnight checkout is still one shift. Next day present needs a second working day of hours.
    const showNextDayPresent = showOtRequest && !syntheticOt && Number(durationHours) > 19;
    return { otText, otHours, showOtRequest, showNextDayPresent };
}
