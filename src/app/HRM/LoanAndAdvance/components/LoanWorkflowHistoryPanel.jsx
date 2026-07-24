'use client';

import { useMemo } from 'react';
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
import { isLoanFullyDisbursed } from '../../LoanAndAdvance/utils/loanStatusConstants';

export default function LoanWorkflowHistoryPanel({ loan, typeLabel = 'Loan' }) {
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
                        (w) =>
                            (w.role === 'Management' || w.role === 'CEO') &&
                            w.status === 'Approved',
                    );
                    return loan.approvedDate || mgtStep?.actionedAt || null;
                }
                if (step.id === 6) {
                    const payStep = workflow.find(
                        (w) => w.role === 'Paid to Employee' && w.status === 'Approved',
                    );
                    return (
                        payStep?.actionedAt ||
                        (isLoanFullyDisbursed(loan) || status === 'Paid' ? loan.updatedAt : null)
                    );
                }
                const wfStep = workflow.find((w) => w.role === step.role && w.status === 'Approved');
                return wfStep?.actionedAt || null;
            },
            isRejected,
            currentActiveStepId: isCancelled ? null : currentActive,
            rejectionReason: loan.rejectionReason,
        });

        const postEvents = buildLoanPostApprovalEvents(loan);
        return mergeWorkflowAndPostEvents(workflowEvents, postEvents, loan);
    }, [loan]);

    return (
        <WorkflowHistoryTimeline
            title={`${typeLabel} Workflow History`}
            subtitle="Approvals, schedule edits, and acknowledgment documents"
            events={events}
            entityKind="loan"
            entityRouteId={loan?.id || loan?._id || loan?.loanId}
        />
    );
}
