import { format } from 'date-fns';
import {
    getPaymentStatusLabel,
    isCompletedPaymentStatus,
    isPendingPaymentStatus,
    isRejectedPaymentStatus,
} from '@/utils/paymentStatusDisplay';

export const STANDARD_WORKFLOW_STEPS = [
    { id: 1, label: 'Created', role: 'System' },
    { id: 2, label: 'Requester', role: 'Requester' },
    { id: 3, label: 'HR', role: 'HR' },
    { id: 4, label: 'Accounts', role: 'Accounts' },
    { id: 5, label: 'Management', role: 'Management' },
];

export function formatHistoryDate(value) {
    if (!value) return null;
    try {
        return format(new Date(value), 'MMM d, yyyy - hh:mm a');
    } catch {
        return null;
    }
}

function formatMonthLabel(value) {
    if (!value) return '—';
    if (typeof value === 'string' && value.includes('/')) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}/.test(value)) {
        const [y, m] = value.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }
    return String(value);
}

export function buildPaymentHistoryEvents({
    paidAmount = 0,
    totalPayable = 0,
    payments = [],
    recordUpdatedAt,
}) {
    const events = [];

    payments.forEach((payment, index) => {
        const amount = Number(payment.amount) || 0;
        if (amount <= 0) return;
        const status = String(payment.status || '').trim();
        if (isRejectedPaymentStatus(status)) return;

        const completed = isCompletedPaymentStatus(status);
        const pending = isPendingPaymentStatus(status);

        events.push({
            id: `payment-record-${payment._id || payment.paymentId || index}`,
            kind: 'payment',
            label: completed ? 'Payment Recorded' : 'Payment Submitted',
            badge: getPaymentStatusLabel(status),
            badgeVariant: completed ? 'approved' : pending ? 'paymentPending' : 'payment',
            actor:
                payment.createdBy?.firstName
                    ? `${payment.createdBy.firstName} ${payment.createdBy.lastName || ''}`.trim()
                    : payment.paidByName || 'Accounts',
            date: payment.paymentDate || payment.createdAt,
            sortIndex: 10000 + index,
            detail: `${amount.toLocaleString()} AED${payment.paymentId ? ` (${payment.paymentId})` : ''}`,
            connectorGreen: completed,
        });
    });

    const paid = Number(paidAmount) || 0;
    const total = Number(totalPayable) || 0;
    if (paid > 0 && events.length === 0) {
        const fullyPaid = total > 0 && paid >= total - 0.01;
        events.push({
            id: fullyPaid ? 'payment-full' : 'payment-partial',
            kind: 'payment',
            label: fullyPaid ? 'Fully Paid' : 'Partially Paid',
            badge: fullyPaid ? 'Paid' : 'Partial',
            badgeVariant: fullyPaid ? 'approved' : 'payment',
            actor: 'Payroll / Accounts',
            date: recordUpdatedAt,
            detail: fullyPaid
                ? `${paid.toLocaleString()} AED`
                : `${paid.toLocaleString()} of ${total.toLocaleString()} AED`,
            connectorGreen: true,
        });
    }

    return events;
}

export function buildScheduleEditEvents({
    originalMonthStart,
    monthStart,
    originalDuration,
    duration,
    durationLabel = 'Duration',
    actor = 'HR',
    updatedAt,
}) {
    const events = [];

    if (originalMonthStart && monthStart && String(originalMonthStart) !== String(monthStart)) {
        events.push({
            id: 'schedule-month',
            kind: 'schedule-edit',
            label: 'Deduction Start Month Updated',
            badge: 'HR Edit',
            badgeVariant: 'info',
            actor,
            date: updatedAt,
            detail: `${formatMonthLabel(originalMonthStart)} → ${formatMonthLabel(monthStart)}`,
            connectorGreen: true,
        });
    }

    const origDur = originalDuration != null ? parseInt(originalDuration, 10) : null;
    const nextDur = duration != null ? parseInt(duration, 10) : null;
    if (origDur != null && nextDur != null && origDur !== nextDur) {
        events.push({
            id: 'schedule-duration',
            kind: 'schedule-edit',
            label: `${durationLabel} Updated`,
            badge: 'HR Edit',
            badgeVariant: 'info',
            actor,
            date: updatedAt,
            detail: `${origDur} month(s) → ${nextDur} month(s)`,
            connectorGreen: true,
        });
    }

    return events;
}

function resolveAttachmentHistory(record) {
    const history = Array.isArray(record?.approvalAttachmentHistory)
        ? [...record.approvalAttachmentHistory]
        : [];

    if (history.length === 0 && Array.isArray(record?.approvalAttachments)) {
        const fallbackDate = record.approvedDate || record.updatedAt || record.createdAt;
        record.approvalAttachments.forEach((att) => {
            if (!att?.url && !att?.name) return;
            history.push({
                ...att,
                addedAt: att.addedAt || fallbackDate,
                trigger: 'management-approval',
            });
        });
    }

    return history.sort((a, b) => {
        const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return ta - tb;
    });
}

function attachmentLinksFromHistory(history, trigger, defaultLabel = 'View PDF') {
    return (history || [])
        .filter((a) => a.trigger === trigger && (a.url || a.publicId))
        .map((att) => ({
            label: att.label || att.name || defaultLabel,
            url: att.url || '',
            publicId: att.publicId || '',
            source: att.source || '',
        }));
}

function attachmentTriggerLabel(trigger) {
    if (trigger === 'management-approval') return 'Approved';
    if (trigger === 'schedule-edit') return 'Updated';
    if (trigger === 'accessory-edit') return 'AC Updated';
    return 'Updated';
}

function attachmentTriggerBadgeVariant(trigger) {
    if (trigger === 'management-approval') return 'approved';
    return 'info';
}

export function buildAttachmentHistoryEvents(attachments = [], { excludeTriggers = [] } = {}) {
    return attachments
        .filter((att) => att?.url || att?.name)
        .filter((att) => !excludeTriggers.includes(att.trigger))
        .map((att, index) => {
            const trigger = att.trigger || 'management-approval';
            const isUpdate = trigger !== 'management-approval';
            return {
                id: `attachment-${trigger}-${att.addedAt || index}-${att.source || att.name || index}`,
                kind: 'attachment',
                label: isUpdate ? `${att.label || att.name || 'Document'} — Regenerated` : att.label || att.name || 'Approval Document',
                badge: attachmentTriggerLabel(trigger),
                badgeVariant: attachmentTriggerBadgeVariant(trigger),
                actor: isUpdate ? 'HR / System' : 'Management',
                date: att.addedAt,
                detail: att.name || '',
                url: att.url || null,
                attachmentMeta: att,
                connectorGreen: true,
            };
        });
}

/** Nest initial approval document links on the Management workflow step. */
export function enrichManagementStepWithAttachments(workflowEvents, record) {
    if (!workflowEvents?.length || !record) return workflowEvents;

    const history = resolveAttachmentHistory(record);
    const links = attachmentLinksFromHistory(history, 'management-approval');
    if (!links.length) return workflowEvents;

    return workflowEvents.map((event) => {
        if (event.id !== 'workflow-5' || event.badgeVariant !== 'approved') return event;
        return { ...event, links };
    });
}

function attachmentToLink(att, defaultLabel = 'View PDF') {
    if (!att) return null;
    return {
        label: att.label || att.name || defaultLabel,
        url: att.url || '',
        publicId: att.publicId || '',
        source: att.source || '',
    };
}

function historyEntryKey(att, index) {
    const stamp = att.addedAt ? new Date(att.addedAt).getTime() : index;
    return `${att.trigger || 'edit'}-${att.publicId || att.source || index}-${stamp}`;
}

function formatScheduleChangeDetail(att) {
    if (!att) return '';
    const parts = [];

    const fromMonth = att.scheduleFromMonth;
    const toMonth = att.scheduleToMonth;
    if (fromMonth && toMonth && String(fromMonth) !== String(toMonth)) {
        parts.push(`${formatMonthLabel(fromMonth)} → ${formatMonthLabel(toMonth)}`);
    }

    const fromDur = att.durationFrom != null ? parseInt(att.durationFrom, 10) : null;
    const toDur = att.durationTo != null ? parseInt(att.durationTo, 10) : null;
    if (fromDur != null && toDur != null && fromDur !== toDur) {
        parts.push(`${fromDur} month(s) → ${toDur} month(s)`);
    }

    return parts.join(' · ');
}

function inferScheduleChangeDetailFromHistory(att, history, attIndex) {
    const stored = formatScheduleChangeDetail(att);
    if (stored) return stored;

    const scheduleEntries = history.filter((h) => h.trigger === 'schedule-edit');
    const pos = scheduleEntries.findIndex(
        (h) => h.addedAt === att.addedAt && h.publicId === att.publicId,
    );
    if (pos <= 0) return '';

    const prev = scheduleEntries[pos - 1];
    const fromMonth = prev.scheduleToMonth || prev.scheduleFromMonth;
    const toMonth = att.scheduleToMonth || prev.scheduleToMonth;
    const parts = [];
    if (fromMonth && toMonth && String(fromMonth) !== String(toMonth)) {
        parts.push(`${formatMonthLabel(fromMonth)} → ${formatMonthLabel(toMonth)}`);
    }
    const fromDur = prev.durationTo ?? prev.durationFrom;
    const toDur = att.durationTo ?? prev.durationTo;
    if (fromDur != null && toDur != null && fromDur !== toDur) {
        parts.push(`${fromDur} month(s) → ${toDur} month(s)`);
    }
    return parts.join(' · ');
}

function sortEventsChronologically(events) {
    return [...events].sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
    });
}

/** One timeline row per post-approval edit (each PDF generation in approvalAttachmentHistory). */
export function buildAttachmentEditHistoryEvents(record, options = {}) {
    const {
        scheduleLabel = 'Deduction Schedule Updated',
        accessoryLabel = 'Accessory Exclusion',
        hrActor = 'HR',
        acActor = 'Asset Controller',
    } = options;

    const history = resolveAttachmentHistory(record);
    const events = [];

    history.forEach((att, index) => {
        if (!att || att.trigger === 'management-approval') return;
        if (!att.url && !att.publicId) return;

        const link = attachmentToLink(att);
        if (!link) return;

        if (att.trigger === 'schedule-edit') {
            const detail = inferScheduleChangeDetailFromHistory(att, history, index);
            events.push({
                id: `history-edit-schedule-${historyEntryKey(att, index)}`,
                kind: 'schedule-edit',
                label: scheduleLabel,
                badge: 'HR Edit',
                badgeVariant: 'info',
                actor: hrActor,
                date: att.addedAt,
                sortIndex: index,
                links: [link],
                detail: detail || undefined,
                connectorGreen: true,
            });
        } else if (att.trigger === 'accessory-edit') {
            events.push({
                id: `history-edit-accessory-${historyEntryKey(att, index)}`,
                kind: 'asset-controller',
                label: accessoryLabel,
                badge: 'Asset Controller',
                badgeVariant: 'info',
                actor: acActor,
                date: att.addedAt,
                sortIndex: index,
                links: [link],
                connectorGreen: true,
            });
        }
    });

    return events;
}

function enrichAccessoryEditEventDetails(editEvents, record) {
    const accessoryEvents = editEvents.filter((e) => e.id.startsWith('history-edit-accessory-'));
    const count = Array.isArray(record.excludedAccessoryIds) ? record.excludedAccessoryIds.length : 0;
    if (!accessoryEvents.length || count <= 0) return editEvents;

    const target = accessoryEvents[accessoryEvents.length - 1];
    return editEvents.map((event) =>
        event.id === target.id
            ? { ...event, detail: `${count} accessory item(s) excluded from fine total` }
            : event,
    );
}

function appendAccessoryExclusionWhenMissing(editEvents, record, acActor = 'Asset Controller') {
    if (editEvents.some((e) => e.id.startsWith('history-edit-accessory-'))) return editEvents;

    const count = Array.isArray(record.excludedAccessoryIds) ? record.excludedAccessoryIds.length : 0;
    const excludedAt = record.accessoryExcludedAt;
    if (count <= 0 || !excludedAt) return editEvents;

    return [
        ...editEvents,
        {
            id: 'accessory-exclusion-recorded',
            kind: 'asset-controller',
            label: 'Accessory Exclusion',
            badge: 'Asset Controller',
            badgeVariant: 'info',
            actor: record.assetControllerName || acActor,
            date: excludedAt,
            sortIndex: 5000,
            detail: `${count} accessory item(s) excluded from fine total`,
            connectorGreen: true,
        },
    ];
}

export function buildAttachmentUpdateEvents(record) {
    const history = resolveAttachmentHistory(record);
    return buildAttachmentHistoryEvents(history, {
        excludeTriggers: ['management-approval'],
    });
}

export function buildFinePostApprovalEvents(fine, { payments = [] } = {}) {
    if (!fine) return [];
    const approved = ['Approved', 'Active', 'Completed', 'Paid'].includes(fine.fineStatus);
    if (!approved) return [];

    const events = [];
    const totalPayable =
        Number(fine.totalFineAmount || fine.fineAmount || 0) ||
        Number(fine.employeeAmount || 0) + Number(fine.companyAmount || 0) + Number(fine.serviceCharge || 0);

    const editEvents = buildAttachmentEditHistoryEvents(fine, {
        scheduleLabel: 'Deduction Schedule Updated',
        hrActor: fine.hrHODName || 'HR',
        acActor: fine.assetControllerName || 'Asset Controller',
    });
    events.push(...appendAccessoryExclusionWhenMissing(enrichAccessoryEditEventDetails(editEvents, fine), fine));

    // PDFs: Management step = initial approval; each edit row = its own regenerated PDF from history.
    events.push(
        ...buildPaymentHistoryEvents({
            paidAmount: fine.paidAmount,
            totalPayable,
            payments,
            recordUpdatedAt: fine.updatedAt,
        })
    );

    if (fine.fineStatus === 'Paid') {
        events.push({
            id: 'status-paid',
            kind: 'status',
            label: 'Fine Marked as Paid',
            badge: 'Completed',
            badgeVariant: 'approved',
            actor: 'System',
            date: fine.updatedAt,
            connectorGreen: true,
        });
    }

    return sortEventsChronologically(events);
}

export function buildLoanPostApprovalEvents(loan, { payments = [] } = {}) {
    if (!loan) return [];
    const status = loan.approvalStatus || loan.status;
    const approved = ['Approved', 'Pending Payment to Employee', 'Paid'].includes(status);
    if (!approved) return [];

    const events = [];
    const typeLabel = loan.type === 'Advance' ? 'Advance' : 'Loan';

    const editEvents = buildAttachmentEditHistoryEvents(loan, {
        scheduleLabel: 'Repayment Schedule Updated',
        hrActor: loan.hrHODName || 'HR',
    });
    events.push(...enrichAccessoryEditEventDetails(editEvents, loan));

    events.push(
        ...buildPaymentHistoryEvents({
            paidAmount: loan.paidAmount,
            totalPayable: loan.amount,
            payments,
            recordUpdatedAt: loan.updatedAt,
        })
    );

    if (status === 'Paid') {
        events.push({
            id: 'loan-status-paid',
            kind: 'status',
            label: `${typeLabel} Marked as Paid`,
            badge: 'Completed',
            badgeVariant: 'approved',
            actor: 'Payroll / Accounts',
            date: loan.updatedAt,
            connectorGreen: true,
        });
    }

    return sortEventsChronologically(events);
}

export function buildWorkflowStepEvents({
    steps,
    workflow = [],
    isStepApproved,
    isConnectorGreen,
    getStepActor,
    getStepDate,
    isRejected,
    currentActiveStepId,
    rejectionReason,
}) {
    return steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const approved = isStepApproved(step);
        const isStepRejected = isRejected && currentActiveStepId === step.id;
        const isStepPending = currentActiveStepId === step.id && !isRejected;

        return {
            id: `workflow-${step.id}`,
            kind: 'workflow',
            stepNumber: step.id,
            label: `${step.label} Stage`,
            badge: approved
                ? 'Approved'
                : isStepRejected
                  ? 'Rejected'
                  : isStepPending
                    ? 'Pending'
                    : 'Scheduled',
            badgeVariant: approved
                ? 'approved'
                : isStepRejected
                  ? 'rejected'
                  : isStepPending
                    ? 'pending'
                    : 'scheduled',
            actor: getStepActor(step),
            date: getStepDate(step),
            rejectionReason: isStepRejected ? rejectionReason : null,
            connectorGreen: !isLast && isConnectorGreen(step),
            isLast,
        };
    });
}

export function mergeWorkflowAndPostEvents(workflowEvents, postEvents, record = null) {
    const enrichedWorkflow = record
        ? enrichManagementStepWithAttachments(workflowEvents, record)
        : workflowEvents;
    const sortedPost = sortEventsChronologically(postEvents);
    return [...enrichedWorkflow, ...sortedPost];
}
