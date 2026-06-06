/** Shared expiry milestone rules — keep in sync with VERP_backend/utils/documentExpiryReminderStages.js */

export const EXPIRY_EMAIL_MILESTONES = [30, 20, 10, 0];

const startOfDay = (d) => {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    x.setHours(0, 0, 0, 0);
    return x;
};

/** Calendar days from today (start of day) to expiry (start of day). Negative = expired. */
export const getDaysUntil = (expiryDate) => {
    if (!expiryDate) return null;
    const today = startOfDay(new Date());
    const exp = startOfDay(expiryDate);
    if (!today || !exp) return null;
    return Math.round((exp - today) / (1000 * 60 * 60 * 24));
};

/** Alias used by notification fallbacks. */
export const getCalendarDaysUntilExpiry = getDaysUntil;

/**
 * Email reminders on exact lead times: 30, 20, 10, and 0 (expiry day).
 * Days 9–1 are task-only (no email).
 */
export const getEmailReminderStageMarker = (daysUntilExpiry) => {
    if (daysUntilExpiry == null) return null;
    if (daysUntilExpiry === 30) return 30;
    if (daysUntilExpiry === 20) return 20;
    if (daysUntilExpiry === 10) return 10;
    if (daysUntilExpiry === 0) return 0;
    return null;
};

/**
 * Dashboard / bell tasks: 30, 20, any day within 10 of expiry (incl. 0), or already expired.
 */
export const isExpiryTaskWindow = (daysUntilExpiry) =>
    daysUntilExpiry != null &&
    (daysUntilExpiry === 30 || daysUntilExpiry === 20 || daysUntilExpiry <= 10);

export const isCertificateExpired = (daysUntilExpiry) =>
    daysUntilExpiry != null && daysUntilExpiry < 0;

export const isCertificateExpiryHrTaskDue = (daysUntilExpiry) =>
    daysUntilExpiry != null &&
    (isCertificateExpired(daysUntilExpiry) || isExpiryTaskWindow(daysUntilExpiry));

export const isExpiryHrTaskDueForDoc = (daysUntilExpiry, { isCertificate = false } = {}) =>
    isCertificate ? isCertificateExpiryHrTaskDue(daysUntilExpiry) : isExpiryTaskWindow(daysUntilExpiry);

/** @deprecated Prefer isExpiryTaskWindow — kept for existing imports */
export const isExpiryNotificationWindow = isExpiryTaskWindow;

export const getExpiryMilestoneTag = (daysUntilExpiry) => {
    if (daysUntilExpiry == null) return null;
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry === 0) return 'Expires today';
    if (daysUntilExpiry === 10) return '10 days left';
    if (daysUntilExpiry === 20) return '20 days left';
    if (daysUntilExpiry === 30) return '30 days left';
    if (daysUntilExpiry <= 10) return `${daysUntilExpiry}d left`;
    return null;
};

/** UI styling for any live document/card expiry field (Trade License, owner docs, certificates, etc.). */
export const getExpiryVisualState = (dateString, { neutral = false } = {}) => {
    if (neutral) return { className: 'text-gray-700 font-normal', tag: null };
    if (!dateString) return { className: 'text-gray-500', tag: null };

    const daysLeft = getDaysUntil(dateString);
    if (daysLeft == null) return { className: 'text-gray-500', tag: null };

    if (daysLeft < 0) {
        return { className: 'text-red-600 font-semibold', tag: 'Expired' };
    }

    const tag = getExpiryMilestoneTag(daysLeft);
    if (tag) {
        return { className: 'text-amber-600 font-semibold', tag };
    }

    return { className: 'text-gray-500', tag: null };
};

export const isExpiredExpiryDate = (dateString) =>
    getExpiryVisualState(dateString).tag === 'Expired';
