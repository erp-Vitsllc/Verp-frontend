'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { DETAIL_PAIR_COLUMN } from '@/utils/headerPairLayout';
import WorkflowHistoryTimeline from '../../shared/workflowHistory/WorkflowHistoryTimeline';
import {
    STANDARD_WORKFLOW_STEPS,
    buildWorkflowStepEvents,
    buildFinePostApprovalEvents,
    mergeWorkflowAndPostEvents,
} from '../../shared/workflowHistory/buildWorkflowHistoryEvents';

const FINE_WORKFLOW_STEPS = STANDARD_WORKFLOW_STEPS;

function isFineWorkflowStepApproved(step, fine, workflow = []) {
    const status = fine?.fineStatus;
    if (['Approved', 'Active', 'Completed', 'Paid'].includes(status)) return true;
    if (step.id === 1) return true;
    if (step.id === 2) return String(status || '').toLowerCase() !== 'draft';
    if (step.id === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (step.id === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (step.id === 5) {
        return workflow.some(
            (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
        );
    }
    return false;
}

function isFineWorkflowConnectorGreen(step, fine, workflow = []) {
    const nextId = step.id + 1;
    if (nextId === 2) return String(fine?.fineStatus || '').toLowerCase() !== 'draft';
    if (nextId === 3) return workflow.some((w) => w.role === 'HR' && w.status === 'Approved');
    if (nextId === 4) return workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved');
    if (nextId === 5) {
        return (
            workflow.some(
                (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
            ) || fine?.fineStatus === 'Approved'
        );
    }
    return false;
}

function getFineCurrentActiveStepId(fine) {
    const statusMap = {
        Draft: 2,
        'Pending HR': 3,
        'Pending Accounts': 4,
        'Pending Authorization': 5,
        Approved: 6,
        Active: 6,
        Completed: 6,
        Paid: 6,
    };
    return statusMap[fine?.fineStatus] || 2;
}

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getFineStepActor(step, fine, workflow) {
    if (step.id === 1) return 'System';
    if (step.id === 2) {
        const creator = fine.createdBy;
        if (!creator) return 'Requester';
        return creator.name || (creator.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : 'Requester');
    }
    if (step.id === 3) {
        const hrStep = workflow.find((w) => w.role === 'HR');
        if (hrStep?.assignedTo?.firstName) {
            return `${hrStep.assignedTo.firstName} ${hrStep.assignedTo.lastName || ''}`.trim();
        }
        if (fine.hrHODName && fine.hrHODName !== 'Unknown') return fine.hrHODName;
        return 'HR Manager';
    }
    if (step.id === 4) {
        const accStep = workflow.find((w) => w.role === 'Accounts');
        if (accStep?.assignedTo?.firstName) {
            return `${accStep.assignedTo.firstName} ${accStep.assignedTo.lastName || ''}`.trim();
        }
        if (fine.accountsHODName && fine.accountsHODName !== 'Unknown') return fine.accountsHODName;
        return 'Accounts Officer';
    }
    if (step.id === 5) {
        const mgtStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
        if (mgtStep?.assignedTo?.firstName) {
            return `${mgtStep.assignedTo.firstName} ${mgtStep.assignedTo.lastName || ''}`.trim();
        }
        if (fine.approvedBy) {
            return (
                fine.approvedBy.name ||
                (fine.approvedBy.firstName
                    ? `${fine.approvedBy.firstName} ${fine.approvedBy.lastName || ''}`.trim()
                    : '')
            );
        }
        if (fine.ceoName && fine.ceoName !== 'Unknown') return fine.ceoName;
        return 'CEO / Management';
    }
    return '';
}

function getFineStepDateRaw(step, fine, workflow) {
    if (step.id <= 2) return fine.createdAt;
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
