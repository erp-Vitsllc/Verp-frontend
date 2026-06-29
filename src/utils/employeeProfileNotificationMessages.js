export function employeeProfileDisplayName(employee = {}) {
    return (
        `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
        employee.employeeId ||
        'Employee'
    );
}

function employeeIdSuffix(employeeId = '') {
    const id = String(employeeId || '').trim();
    return id ? ` (${id})` : '';
}

export function buildProfileActivationPendingMessage({
    employeeName = 'Employee',
    employeeId = '',
    activationType = 'New Activation',
    submittedBy = '',
    pendingCards = [],
    reason = '',
} = {}) {
    const name = String(employeeName || 'Employee').trim() || 'Employee';
    const typeLabel =
        String(activationType || '').toLowerCase() === 'reactivation'
            ? 'reactivation'
            : 'new profile activation';
    const submitterPart = submittedBy ? `, submitted by ${submittedBy}` : '';
    let message = `Profile activation for ${name}${employeeIdSuffix(employeeId)} — ${typeLabel}${submitterPart}, is pending HR review.`;
    if (reason) message += ` Reason: ${String(reason).trim()}.`;
    if (Array.isArray(pendingCards) && pendingCards.length) {
        message += ` Changes requested: ${pendingCards.join(', ')}.`;
    }
    return message.replace(/\s+/g, ' ').trim();
}

export function buildProfileActivationHoldMessage({
    employeeName = 'Employee',
    employeeId = '',
    unapprovedCards = [],
} = {}) {
    const name = String(employeeName || 'Employee').trim() || 'Employee';
    const cards = (unapprovedCards || []).map((c) => String(c || '').trim()).filter(Boolean);
    const cardsPart = cards.length ? ` Update required for: ${cards.join(', ')}.` : '';
    return `Profile activation for ${name}${employeeIdSuffix(employeeId)} is on hold — please review HR feedback, complete the required updates,${cardsPart} and resubmit.`
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildProfileActivationRejectedMessage({
    employeeName = 'Employee',
    employeeId = '',
} = {}) {
    const name = String(employeeName || 'Employee').trim() || 'Employee';
    return `Profile activation for ${name}${employeeIdSuffix(employeeId)} was rejected — review HR comments, update the profile, and resubmit for approval.`;
}

export function buildProfileActivationApprovedMessage({
    employeeName = 'Employee',
    employeeId = '',
} = {}) {
    const name = String(employeeName || 'Employee').trim() || 'Employee';
    return `Profile activation for ${name}${employeeIdSuffix(employeeId)} was approved — the profile is now live and active.`;
}

export function buildProfileActivationSubmittedOutcomeMessage({
    employeeName = 'Employee',
    employeeId = '',
    status = 'Pending',
} = {}) {
    const name = String(employeeName || 'Employee').trim() || 'Employee';
    const normalized = String(status || 'Pending').trim();
    if (normalized === 'Approved') {
        return buildProfileActivationApprovedMessage({ employeeName: name, employeeId });
    }
    if (normalized === 'Rejected') {
        return buildProfileActivationRejectedMessage({ employeeName: name, employeeId });
    }
    if (normalized === 'On Hold') {
        return buildProfileActivationHoldMessage({ employeeName: name, employeeId });
    }
    return `Your profile activation request for ${name}${employeeIdSuffix(employeeId)} has been submitted and is awaiting HR review.`;
}

export function buildProfileIncompleteMessage({
    employeeName = 'Employee',
    employeeId = '',
} = {}) {
    const name = String(employeeName || 'Employee').trim() || 'Employee';
    return `Profile incomplete for ${name}${employeeIdSuffix(employeeId)} — please complete all mandatory profile cards to reach 100%.`;
}

function parseNameIdFromExtra2(extra2 = '') {
    const raw = String(extra2 || '').trim();
    const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (!match) return { employeeName: raw || '', employeeId: '' };
    return { employeeName: match[1].trim(), employeeId: match[2].trim() };
}

/** Name + employee ID embedded in notification sentence text. */
export function parseProfileSubjectFromMessage(text = '') {
    const raw = String(text || '').trim();
    if (!raw) return { employeeName: '', employeeId: '' };
    const match = raw.match(
        /(?:profile activation|profile incomplete|your profile activation request) for\s+(.+?)\s*\(([^)]+)\)/i,
    );
    if (!match) return { employeeName: '', employeeId: '' };
    return { employeeName: match[1].trim(), employeeId: match[2].trim() };
}

function looksLikeEmployeeId(value = '') {
    const id = String(value || '').trim();
    if (!id) return false;
    if (/^VEGA-/i.test(id)) return true;
    if (/[A-Z]{2,}/.test(id) && /[-_]/.test(id)) return true;
    if (/^\d{4,}$/.test(id)) return true;
    return id.length >= 6 && /[0-9]/.test(id);
}

function isNameIdExtra2(extra2 = '') {
    const parsed = parseNameIdFromExtra2(extra2);
    return Boolean(parsed.employeeName && parsed.employeeId && looksLikeEmployeeId(parsed.employeeId));
}

/** Entity chip for profile notifications — profile subject name/ID, never designation-only extra2. */
export function resolveEmployeeProfileNotificationEntity(item = {}) {
    const fromMessage = parseProfileSubjectFromMessage(item?.extra1);
    if (fromMessage.employeeName || fromMessage.employeeId) {
        return fromMessage;
    }

    if (isNameIdExtra2(item?.extra2)) {
        return parseNameIdFromExtra2(item?.extra2);
    }

    const subjectName = String(item?.subjectName || '').trim();
    const targetEmployeeId = String(item?.targetEmployeeId || item?.employeeId || '').trim();
    if (subjectName || targetEmployeeId) {
        return { employeeName: subjectName, employeeId: targetEmployeeId };
    }

    const extra1 = String(item?.extra1 || '').trim();
    if (looksLikeEmployeeId(extra1)) {
        return { employeeName: '', employeeId: extra1 };
    }

    return { employeeName: '', employeeId: '' };
}

function parseLegacyActivationExtra1(extra1 = '') {
    const raw = String(extra1 || '').trim();
    if (!raw) return null;
    if (/^profile activation/i.test(raw) || /^profile incomplete/i.test(raw) || /^your profile activation/i.test(raw)) {
        return raw;
    }
    if (raw.startsWith('[Employee profile]')) {
        const body = raw.replace(/^\[Employee profile\]\s*/i, '').trim();
        return `Profile activation for employee — ${body.charAt(0).toLowerCase()}${body.slice(1)}`.replace(/\s+/g, ' ').trim();
    }
    if (/^actioned:\s*/i.test(raw)) {
        return null;
    }
    return null;
}

export function formatEmployeeProfileActivationDisplay(item = {}) {
    if (String(item?.type || '').trim() !== 'Profile Activation') return null;

    const profileSubject = resolveEmployeeProfileNotificationEntity(item);
    const employeeId =
        profileSubject.employeeId ||
        String(item?.targetEmployeeId || item?.extra1 || '').trim();
    const employeeName =
        profileSubject.employeeName ||
        String(item?.subjectName || '').trim() ||
        (employeeId && String(item?.extra1 || '').trim() === employeeId ? 'Employee' : '');

    const direct = parseLegacyActivationExtra1(item?.extra1);
    if (direct && !employeeName && !employeeId) {
        return { headline: direct, detail: null };
    }

    if (employeeName || employeeId) {
        const status = String(item?.status || 'Pending').trim();
        const scope = String(item?.scope || '').trim();
        if (scope === 'outgoing' || item?.requestedBy === 'Me') {
            return {
                headline: buildProfileActivationSubmittedOutcomeMessage({
                    employeeName: employeeName || 'Employee',
                    employeeId,
                    status,
                }),
                detail: null,
            };
        }
        if (status === 'On Hold') {
            return {
                headline: buildProfileActivationHoldMessage({
                    employeeName: employeeName || 'Employee',
                    employeeId,
                }),
                detail: null,
            };
        }
        if (status === 'Rejected') {
            return {
                headline: buildProfileActivationRejectedMessage({
                    employeeName: employeeName || 'Employee',
                    employeeId,
                }),
                detail: null,
            };
        }
        if (status === 'Approved') {
            return {
                headline: buildProfileActivationApprovedMessage({
                    employeeName: employeeName || 'Employee',
                    employeeId,
                }),
                detail: null,
            };
        }
        return {
            headline: buildProfileActivationPendingMessage({
                employeeName: employeeName || 'Employee',
                employeeId,
                submittedBy: item?.requestedBy && item.requestedBy !== 'Me' ? item.requestedBy : '',
            }),
            detail: null,
        };
    }

    const fallback = String(item?.extra1 || '').trim();
    if (fallback) return { headline: fallback, detail: null };
    return null;
}

export function formatEmployeeProfileIncompleteDisplay(item = {}) {
    if (String(item?.type || '').trim() !== 'Profile Incomplete') return null;

    const message = String(item?.extra1 || '').trim();
    if (/^profile incomplete/i.test(message)) {
        return { headline: message, detail: null };
    }

    const fromExtra2 = parseNameIdFromExtra2(item?.extra2);
    const employeeId = String(item?.targetEmployeeId || fromExtra2.employeeId || '').trim();
    const employeeName = fromExtra2.employeeName || '';

    if (employeeName || employeeId) {
        return {
            headline: buildProfileIncompleteMessage({
                employeeName: employeeName || 'Employee',
                employeeId,
            }),
            detail: null,
        };
    }

    if (/missing mandatory cards/i.test(message)) {
        return { headline: buildProfileIncompleteMessage({ employeeName: 'Employee', employeeId: '' }), detail: message };
    }

    const label = message.replace(/^Complete:\s*/i, '').trim();
    return {
        headline: label
            ? buildProfileIncompleteMessage({ employeeName: label, employeeId: '' })
            : buildProfileIncompleteMessage({ employeeName: 'Employee', employeeId: '' }),
        detail: String(item?.extra2 || '').trim() || null,
    };
}
