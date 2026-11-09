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
import { isFineAccountsSettlementDone } from '../utils/fineListDisplay';

const FINE_WORKFLOW_STEP_DEFS = [
    { key: 'created', label: 'Created', role: 'Creator' },
    { key: 'admin', label: 'Admin Officer', role: 'Admin Officer' },
    { key: 'requester', label: 'Requester', role: 'Requester' },
    { key: 'hr', label: 'HR', role: 'HR' },
    { key: 'accounts', label: 'Accounts', role: 'Accounts' },
    { key: 'management', label: 'Management', role: 'Management' },
    { key: 'pay', label: 'Make Payment', role: 'Accounts' },
];

function fineHasAdminOfficerStage(fine, workflow = []) {
    if (String(fine?.fineStatus || '') === 'Pending Admin') return true;
    return (workflow || []).some((step) => step.role === 'Admin Officer');
}

function buildFineWorkflowSteps(fine, workflow = []) {
    const includeAdmin = fineHasAdminOfficerStage(fine, workflow);
    return FINE_WORKFLOW_STEP_DEFS
        .filter((step) => step.key !== 'admin' || includeAdmin)
        .map((step, index) => ({ ...step, id: index + 1 }));
}

/** Done and current steps stay in order. Steps not started yet move to the end. */
function sortFineTrackerSteps(steps, fine, workflow = []) {
    const activeId = getFineCurrentActiveStepId(fine, steps, workflow);
    const reached = [];
    const later = [];
    for (const step of steps) {
        const started = isFineWorkflowStepApproved(step, fine, workflow) || step.id === activeId;
        if (started) reached.push(step);
        else later.push(step);
    }
    return [...reached, ...later].map((step, index) => ({ ...step, id: index + 1 }));
}

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

function isMakePaymentDone(fine) {
    return isFineAccountsSettlementDone(fine);
}

function isAdminOfficerApprovalDone(workflow = []) {
    return workflow.some((step) => step.role === 'Admin Officer' && step.status === 'Approved');
}

function isFineWorkflowStepApproved(step, fine, workflow = []) {
    const status = String(fine?.fineStatus || '');
    if (step.key === 'created') return true;
    if (step.key === 'admin') return isAdminOfficerApprovalDone(workflow);
    if (step.key === 'requester') return status.toLowerCase() !== 'draft' && status !== 'Pending Admin';
    if (step.key === 'hr') return isHrApprovalDone(fine, workflow);
    if (step.key === 'accounts') return isAccountsApprovalDone(fine, workflow);
    if (step.key === 'management') return isManagementApprovalDone(fine, workflow);
    if (step.key === 'pay') return isMakePaymentDone(fine);
    return false;
}

function isFineWorkflowConnectorGreen(step, steps, fine, workflow = []) {
    const next = steps.find((item) => item.id === step.id + 1);
    if (!next) return false;
    return isFineWorkflowStepApproved(next, fine, workflow);
}

function getFineCurrentActiveStepId(fine, steps, workflow = []) {
    const status = String(fine?.fineStatus || '');
    const idFor = (key) => steps.find((step) => step.key === key)?.id || 2;
    if (status === 'Rejected') {
        const rejected = (workflow || []).find((step) => step.status === 'Rejected');
        if (rejected?.role === 'Admin Officer') return idFor('admin');
        if (rejected?.role === 'HR') return idFor('hr');
        if (rejected?.role === 'Accounts') return idFor('accounts');
        if (rejected?.role === 'Management' || rejected?.role === 'CEO') return idFor('management');
    }
    if (status === 'Draft') return idFor('requester');
    if (status === 'Pending Admin') return idFor('admin');
    if (status === 'Pending HR' || status === 'Pending Review' || status === 'Pending') return idFor('hr');
    if (status === 'Pending Accounts' || status === 'Pending Finance') return idFor('accounts');
    if (status === 'Pending Authorization' || status === 'Pending Management') return idFor('management');
    if (['Approved', 'Active'].includes(status) && !isMakePaymentDone(fine)) return idFor('pay');
    if (['Approved', 'Active', 'Completed', 'Paid'].includes(status)) return idFor('pay') + 1;
    return idFor('requester');
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
    if (step.key === 'created' || step.key === 'requester') return resolveCreatorName(fine);
    if (step.key === 'admin') {
        const adminStep = workflow.find((w) => w.role === 'Admin Officer');
        const fromWf = resolvePersonName(adminStep?.assignedTo);
        if (fromWf) return fromWf;
        return 'Admin Officer';
    }
    if (step.key === 'hr') {
        const hrStep = workflow.find((w) => w.role === 'HR');
        const fromWf = resolvePersonName(hrStep?.assignedTo);
        if (fromWf) return fromWf;
        const fromApprover = resolvePersonName(fine.hrApprovedBy);
        if (fromApprover) return fromApprover;
        if (fine.hrHODName && fine.hrHODName !== 'Unknown') return fine.hrHODName;
        return 'HR Manager';
    }
    if (step.key === 'accounts') {
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
    if (step.key === 'management') {
        const mgtStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
        const managementReached = mgtStep && (mgtStep.status === 'Pending' || mgtStep.status === 'Approved');
        if (managementReached) {
            const fromWf = resolvePersonName(mgtStep?.assignedTo);
            if (fromWf) return fromWf;
        }
        const fromApprover = resolvePersonName(fine.approvedBy);
        if (fromApprover) return fromApprover;
        if (fine.ceoName && fine.ceoName !== 'Unknown') return fine.ceoName;
        return 'CEO / Management';
    }
    if (step.key === 'pay') {
        const fromPayer = resolvePersonName(fine.accountsPaymentBy);
        if (fromPayer) return fromPayer;
        if (fine.accountsHODName && fine.accountsHODName !== 'Unknown') return fine.accountsHODName;
        const accStep = workflow.find((w) => w.role === 'Accounts');
        const fromWf = resolvePersonName(accStep?.assignedTo);
        if (fromWf) return fromWf;
        return 'Accounts';
    }
    return '';
}

function getFineStepDateRaw(step, fine, workflow) {
    if (step.key === 'created' || step.key === 'requester') return fine.createdAt;
    if (step.key === 'admin') {
        const adminStep = workflow.find((w) => w.role === 'Admin Officer' && w.status === 'Approved');
        return adminStep?.actionedAt || null;
    }
    if (step.key === 'accounts') {
        const accStep = workflow.find((w) => w.role === 'Accounts' && w.status === 'Approved');
        return accStep?.actionedAt || null;
    }
    if (step.key === 'management') {
        const mgtStep = workflow.find(
            (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
        );
        return fine.approvedDate || mgtStep?.actionedAt || null;
    }
    if (step.key === 'pay') {
        return fine.accountsPaymentAt || fine.zohoSyncedAt || fine.vendorBillPaidAt || null;
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
        const steps = sortFineTrackerSteps(buildFineWorkflowSteps(fine, workflow), fine, workflow);
        const isRejected = fine.fineStatus === 'Rejected';
        const currentActive = getFineCurrentActiveStepId(fine, steps, workflow);

        const workflowEvents = buildWorkflowStepEvents({
            steps,
            workflow,
            isStepApproved: (step) => isFineWorkflowStepApproved(step, fine, workflow),
            isConnectorGreen: (step) => isFineWorkflowConnectorGreen(step, steps, fine, workflow),
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
