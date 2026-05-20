/** Actions that belong to the asset service timeline (tools / equipment). */
export const SERVICE_HISTORY_ACTIONS = [
    'Service',
    'Maintenance',
    'Repair',
    'Live',
    'Service Send',
    'Service Receive',
    'Extend',
];

export function formatServiceHistoryDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatServiceHistoryDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Human-readable rows for service history cards (from history.details). */
export function getServiceHistoryDetailRows(details = {}) {
    if (!details || typeof details !== 'object') return [];

    const rows = [];
    const add = (label, value) => {
        if (value === undefined || value === null || value === '') return;
        rows.push({ label, value: String(value) });
    };

    const event = details.serviceEventType;
    if (event === 'sent') add('Event', 'Sent to service');
    if (event === 'extend') add('Event', details.isBulk ? 'Service extended (bulk)' : 'Service extended');
    if (event === 'live') add('Event', details.isBulk ? 'Marked live (bulk)' : 'Marked live');
    if (event === 'return') add('Event', 'Returned from service');

    add('Previous status', details.prevAssetStatus);
    add('New status', details.nextAssetStatus);
    add('Service start', formatServiceHistoryDate(details.serviceStartDate));
    add('Expected return', formatServiceHistoryDate(details.serviceExpiryDate));
    add('Previous expiry', formatServiceHistoryDate(details.previousExpiryDate));
    add('New expiry', formatServiceHistoryDate(details.newExpiryDate));
    if (details.serviceDuration) add('Planned duration', details.serviceDuration);
    else if (details.updatedTotalDays != null) add('Total duration', `${details.updatedTotalDays} days`);
    if (details.extensionDays != null) add('Extension (+days)', details.extensionDays);
    if (details.previousDurationDays != null) add('Duration before extend', `${details.previousDurationDays} days`);
    if (details.updatedTotalDays != null) add('Total duration after extend', `${details.updatedTotalDays} days`);
    add('Extension reason', details.extensionReason);
    add('Description', details.serviceDescription);
    add('Service report', details.serviceReport);
    if (details.amount > 0) add('Cost (QAR)', Number(details.amount).toLocaleString());
    add('Completed at', formatServiceHistoryDateTime(details.completedAt));

    return rows;
}

/**
 * Group service history into sessions: send → extends[] → receive.
 */
export function groupAssetServiceHistorySessions(historyItems = []) {
    const sorted = [...historyItems]
        .filter((h) => SERVICE_HISTORY_ACTIONS.includes(h.action))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const sessions = [];
    let current = null;

    sorted.forEach((item) => {
        const isSend = ['Service', 'Service Send', 'Maintenance', 'Repair'].includes(item.action);
        const isExtend = item.action === 'Extend';
        const isReceive = ['Live', 'Service Receive'].includes(item.action);

        if (isSend) {
            if (current) sessions.push(current);
            current = { id: item._id, send: item, extends: [], receive: null };
        } else if (isExtend) {
            if (!current) current = { id: item._id, send: null, extends: [], receive: null };
            current.extends.push(item);
        } else if (isReceive) {
            if (current) {
                current.receive = item;
                sessions.push(current);
                current = null;
            } else {
                sessions.push({ id: item._id, send: null, extends: [], receive: item });
            }
        }
    });
    if (current) sessions.push(current);

    return sessions.reverse();
}
