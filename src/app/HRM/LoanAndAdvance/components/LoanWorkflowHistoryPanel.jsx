'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import WorkflowHistoryTimeline from '../../shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildWorkflowStepEvents,
    buildLoanPostApprovalEvents,
    mergeWorkflowAndPostEvents,
} from '../../shared/workflowHistory/buildWorkflowHistoryEvents';
import {
    LOAN_WORKFLOW_STEPS,
    getLoanStatusStepId,
    isLoanWorkflowConnectorGreen,
    isLoanWorkflowStepApproved,
    getLoanStepActor,
    toTitleCase,
} from '../../LoanAndAdvance/utils/loanWorkflowUtils';

export default function LoanWorkflowHistoryPanel({ loan, typeLabel = 'Loan' }) {
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        if (!loan?.loanId) return;
        const paymentType = loan.type === 'Advance' ? 'Advance' : 'Loan';
        axiosInstance
            .get('/Payment', {
                params: {
                    referenceId: loan.loanId,
                    relatedEntityType: 'Loan',
                    paymentType,
                    limit: 50,
                },
            })
            .then((res) => setPayments(res.data?.payments || []))
            .catch(() => setPayments([]));
    }, [loan?.loanId, loan?.type]);

    const events = useMemo(() => {
        if (!loan) return [];
        const workflow = loan.workflow || [];
        const status = loan.approvalStatus || loan.status;
        const isRejected = status === 'Rejected';
        const isCancelled = status === 'Cancelled';
        const currentActive = getLoanStatusStepId(loan);

        const workflowEvents = buildWorkflowStepEvents({
            steps: LOAN_WORKFLOW_STEPS,
            workflow,
            isStepApproved: (step) => isLoanWorkflowStepApproved(step, loan, workflow),
            isConnectorGreen: (step) => isLoanWorkflowConnectorGreen(step, loan, workflow),
            getStepActor: (step) => toTitleCase(getLoanStepActor(step, loan, workflow)),
            getStepDate: (step) => {
                if (step.id <= 2) return loan.createdAt;
                if (step.id === 5) {
                    const mgtStep = workflow.find(
                        (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
                    );
                    return loan.approvedDate || mgtStep?.actionedAt || null;
                }
                if (step.id === 6) {
                    const payStep = workflow.find(
                        (w) => w.role === 'Paid to Employee' && w.status === 'Approved'
                    );
                    return payStep?.actionedAt || (status === 'Paid' ? loan.updatedAt : null);
                }
                const wfStep = workflow.find((w) => w.role === step.role && w.status === 'Approved');
                return wfStep?.actionedAt || null;
            },
            isRejected,
            currentActiveStepId: isCancelled ? null : currentActive,
            rejectionReason: loan.rejectionReason,
        });

        const postEvents = buildLoanPostApprovalEvents(loan, { payments });
        return mergeWorkflowAndPostEvents(workflowEvents, postEvents, loan);
    }, [loan, payments]);

    return (
        <WorkflowHistoryTimeline
            title={`${typeLabel} Workflow History`}
            subtitle="Approvals, payments, schedule edits, and acknowledgment documents"
            events={events}
            entityKind="loan"
            entityRouteId={loan?.id || loan?._id || loan?.loanId}
        />
    );
}
