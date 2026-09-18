'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { DETAIL_PAIR_COLUMN } from '@/utils/headerPairLayout';
import WorkflowHistoryTimeline from '../../shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildWorkflowStepEvents,
    buildFinePostApprovalEvents,
    mergeWorkflowAndPostEvents,
} from '../../shared/workflowHistory/buildWorkflowHistoryEvents';

const FINE_WORKFLOW_STEPS = [
    { id: 1, label: 'Created', role: 'Creator' },
    { id: 2, label: 'Requester', role: 'Requester' },
    { id: 3, label: 'HR', role: 'HR' },
    { id: 4, label: 'Accounts', role: 'Accounts' },
    { id: 5, label: 'Management', role: 'Management' },
];

function isHrApprovalDone(fine, workflow = []) {
    return Boolean(fine?.hrApprovedBy) || workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
}

function isAccountsApprovalDone(fine, workflow = []) {
    return Boolean(fine?.accountsApprovedBy) ||
        workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
}

function isManagementApprovalDone(fine, workflow = []) {
    return (
        Boolean(fine?.approvedBy) ||
        workflow.some((w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved')
    );
}

function isFineWorkflowStepApproved(step, fine, workflow = []) {
    const status = fine?.fineStatus;
    if (step.id === 1) return true;
    if (step.id === 2) return String(status || '').toLowerCase() !== 'draft';
    if (step.id === 3) return isHrApprovalDone(fine, workflow);
    if (step.id === 4) return isAccountsApprovalDone(fine, workflow);
    if (step.id === 5) return isManagementApprovalDone(fine, workflow);
    return false;
}

function isFineWorkflowConnectorGreen(step, fine, workflow = []) {
    const nextId = step.id + 1;
    if (nextId === 2) return String(fine?.fineStatus || '').toLowerCase() !== 'draft';
    if (nextId === 3) return isHrApprovalDone(fine, workflow);
    if (nextId === 4) return isAccountsApprovalDone(fine, workflow);
    if (nextId === 5) return isManagementApprovalDone(fine, workflow);
    return false;
}

function getFineCurrentActiveStepId(fine) {
    const status = fine?.fineStatus;
    if (status === 'Draft') return 2;
    if (status === 'Pending HR' || status === 'Pending Review' || status === 'Pending') return 3;
    if (status === 'Pending Accounts' || status === 'Pending Finance') return 4;
    if (status === 'Pending Authorization' || status === 'Pending Management') return 5;
    if (['Approved', 'Active', 'Completed', 'Paid'].includes(status)) return 6;
    return 2;
}

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function isUsableDisplayName(value) {
    const named = String(value || '').trim();
    if (!named) return false;
    if (/^(unknown|system|n\/a)$/i.test(named)) return false;
    if (/^[a-fA-F0-9]{24}$/.test(named)) return false;
    return true;
}

/** User has `name`; EmployeeBasic has firstName/lastName. */
function resolvePersonName(person) {
    if (!person) return '';
    if (typeof person === 'string') return isUsableDisplayName(person) ? person.trim() : '';
    if (typeof person !== 'object') return '';
    const named = String(person.name || '').trim();
    if (isUsableDisplayName(named)) return named;
    const full = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    return isUsableDisplayName(full) ? full : '';
}

function resolveCreatorName(fine) {
    return resolvePersonName(fine?.createdBy) || 'Creator';
}

function getFineStepActor(step, fine, workflow) {
    if (step.id === 1 || step.id === 2) return resolveCreatorName(fine);
    if (step.id === 3) {
        const hrStep = workflow.find((w) => w.role === 'HR');
        const fromWf = resolvePersonName(hrStep?.assignedTo);
        if (fromWf) return fromWf;
        const fromApprover = resolvePersonName(fine.hrApprovedBy);
        if (fromApprover) return fromApprover;
        if (fine.hrHODName && fine.hrHODName !== 'Unknown') return fine.hrHODName;
        return 'HR Manager';
    }
    if (step.id === 4) {
        const accStep = workflow.find((w) => w.role === 'Accounts');
        const fromWf = resolvePersonName(accStep?.assignedTo);
        if (fromWf) return fromWf;
        const fromApprover = resolvePersonName(fine.accountsApprovedBy);
        if (fromApprover) return fromApprover;
        const fromSubmitted = resolvePersonName(fine.submittedTo);
        if (fromSubmitted && (fine.fineStatus === 'Pending Accounts' || fine.fineStatus === 'Pending Finance')) {
            return fromSubmitted;
        }
        if (fine.accountsHODName && fine.accountsHODName !== 'Unknown') return fine.accountsHODName;
        return 'Accounts Officer';
    }
    if (step.id === 5) {
        const mgtStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
        const fromWf = resolvePersonName(mgtStep?.assignedTo);
        if (fromWf) return fromWf;
        const fromApprover = resolvePersonName(fine.approvedBy);
        if (fromApprover) return fromApprover;
        const fromSubmitted = resolvePersonName(fine.submittedTo);
        if (fromSubmitted) return fromSubmitted;
        if (fine.ceoName && fine.ceoName !== 'Unknown') return fine.ceoName;
        return 'CEO / Management';
    }
    return '';
}

function getFineStepDateRaw(step, fine, workflow) {
    if (step.id <= 2) return fine.createdAt;
    if (step.id === 4) {
        const accStep = workflow.find((w) => w.role === 'Accounts' && w.status === 'Approved');
        return accStep?.actionedAt || null;
    }
    if (step.id === 5) {
        const mgtStep = workflow.find(
            (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
        );
        return fine.approvedDate || mgtStep?.actionedAt || null;
    }
    const wfStep = workflow.find((w) => w.role === step.role && w.status === 'Approved');
    return wfStep?.actionedAt || null;
}

export default function FineWorkflowHistoryPanel({ fine }) {
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        if (!fine?.fineId) return;
        axiosInstance
            .get('/Payment', {
                params: {
                    referenceId: fine.fineId,
                    relatedEntityType: 'Fine',
                    limit: 50,
                },
            })
            .then((res) => setPayments(res.data?.payments || []))
            .catch(() => setPayments([]));
    }, [fine?.fineId]);

    const events = useMemo(() => {
        if (!fine) return [];
        const workflow = fine.workflow || [];
        const isRejected = fine.fineStatus === 'Rejected';
        const currentActive = getFineCurrentActiveStepId(fine);

        const workflowEvents = buildWorkflowStepEvents({
            steps: FINE_WORKFLOW_STEPS,
            workflow,
            isStepApproved: (step) => isFineWorkflowStepApproved(step, fine, workflow),
            isConnectorGreen: (step) => isFineWorkflowConnectorGreen(step, fine, workflow),
            getStepActor: (step) => toTitleCase(getFineStepActor(step, fine, workflow)),
            getStepDate: (step) => getFineStepDateRaw(step, fine, workflow),
            isRejected,
            currentActiveStepId: currentActive,
            rejectionReason: fine.rejectionReason,
        });

        const postEvents = buildFinePostApprovalEvents(fine, { payments });
        return mergeWorkflowAndPostEvents(workflowEvents, postEvents, fine);
    }, [fine, payments]);

    return (
        <div className={`${DETAIL_PAIR_COLUMN} bg-white rounded-2xl border border-gray-100 shadow-sm p-6`}>
            <WorkflowHistoryTimeline
                title="Fine Workflow History"
                subtitle="Approvals, payments, schedule edits, and asset controller actions"
                events={events}
                entityKind="fine"
                entityRouteId={fine?.fineId || fine?._id}
            />
        </div>
    );
}
