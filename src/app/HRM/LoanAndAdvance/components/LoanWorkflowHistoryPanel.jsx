'use client';

import { useMemo } from 'react';
import WorkflowHistoryTimeline from '../../shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildWorkflowStepEvents,
    buildLoanPostApprovalEvents,
    mergeWorkflowAndPostEvents,
} from '../../shared/workflowHistory/buildWorkflowHistoryEvents';
import {
    getLoanWorkflowSteps,
    getLoanStatusStepId,
    isLoanWorkflowConnectorGreen,
    isLoanWorkflowStepApproved,
    getLoanStepActor,
    getLoanStepDate,
    toTitleCase,
} from '../../LoanAndAdvance/utils/loanWorkflowUtils';

export default function LoanWorkflowHistoryPanel({ loan, typeLabel = 'Loan' }) {
    const events = useMemo(() => {
        if (!loan) return [];
        const workflow = loan.workflow || [];
        const status = loan.approvalStatus || loan.status;
        const isRejected = status === 'Rejected';
        const isCancelled = status === 'Cancelled';
        const currentActive = getLoanStatusStepId(loan);

        const workflowEvents = buildWorkflowStepEvents({
            steps: getLoanWorkflowSteps(loan),
            workflow,
            isStepApproved: (step) => isLoanWorkflowStepApproved(step, loan, workflow),
            isConnectorGreen: (step) => isLoanWorkflowConnectorGreen(step, loan, workflow),
            getStepActor: (step) => toTitleCase(getLoanStepActor(step, loan, workflow)),
            getStepDate: (step) => getLoanStepDate(step, loan, workflow),
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
