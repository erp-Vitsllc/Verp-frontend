import {
    isAssetAssignmentAcknowledgmentPending,
    isLeaveActive,
    isServiceActive,
} from '@/utils/assetStatusHelpers';
import { canPerformAssetAction, mapHeaderLabelToAssetAction } from './canPerformAssetAction';

function shouldIncludeHeaderAction(action, asset) {
    if (action.label === 'TRANSFER ASSET') {
        if (isLeaveActive(asset)) return false;
        return asset?.status === 'Assigned' || !asset?.assignedTo;
    }
    if (action.label.startsWith('Reassign') || action.label === 'Assign') {
        return !isLeaveActive(asset);
    }
    if (action.label === 'Return Asset') {
        return String(asset?.status || '').trim().toLowerCase() !== 'lost';
    }
    if (action.label === 'Loss and Damage') {
        return true;
    }
    if (action.label === 'Request On Duty') {
        return isLeaveActive(asset);
    }
    if (action.label === 'Confirm On Duty') {
        return false;
    }
    if (action.label === 'Service') {
        return true;
    }
    if (action.label === 'Extend Service') {
        return isServiceActive(asset);
    }
    return true;
}

/**
 * Applies visibility, permission, and disabled rules to tools asset header actions.
 */
export function evaluateToolsAssetHeaderActions(actions, ctx) {
    const {
        asset,
        userIsAdmin,
        currentUserEmployeeId,
        currentUserId,
        effectiveIsAssetController,
        isAssetDraftStatus,
        isRejectedStatus,
        isDeleting,
        requestingOwnerOnDuty,
        pendingOwnerOnDutyAcRequestId,
        pendingOwnerOnDutyReviewId,
        assetActionUser,
    } = ctx;

    const isAdmin = userIsAdmin;
    const isAssetControllerById =
        currentUserEmployeeId?.toString() === asset?.assetControllerId?.toString() ||
        currentUserEmployeeId?.toString() === 'flowchart_assetcontroller';
    const isAuthorized = isAdmin || isAssetControllerById || effectiveIsAssetController;

    const assignedToRef = asset?.assignedTo?._id ?? asset?.assignedTo;
    const isAssignedUser =
        !!assignedToRef && currentUserEmployeeId?.toString() === assignedToRef.toString();

    const assignedByRef = asset?.assignedBy?._id ?? asset?.assignedBy;
    const isAssignerUser =
        !!assignedByRef && currentUserEmployeeId?.toString() === assignedByRef.toString();

    const assigneeCompanyEmail = asset?.assignedTo?.companyEmail;
    const assigneeHasCompanyEmail = !!(assigneeCompanyEmail && String(assigneeCompanyEmail).trim().length > 0);
    const primaryReporteeRef =
        asset?.assignedTo?.primaryReportee?._id ?? asset?.assignedTo?.primaryReportee;
    const isPrimaryReporteeDelegate =
        !assigneeHasCompanyEmail &&
        !!primaryReporteeRef &&
        currentUserEmployeeId?.toString() === primaryReporteeRef.toString();

    const isCreator =
        asset?.createdBy?._id?.toString() === currentUserId || asset?.createdBy?.toString() === currentUserId;

    const isOutOfService = asset.status === 'Out of Service';
    const isLost = asset.status === 'Lost';
    const statusRaw = String(asset?.status ?? '').trim();
    const isUnassignedStatus = statusRaw === 'Unassigned';
    const statusLower = statusRaw.toLowerCase();
    const isSubmittedForApprovalState = statusLower === 'submitted for approval';
    const isDraft = statusLower === 'draft';
    const isSaveOnlyDraft = isDraft && !asset?.actionRequiredBy;
    const isPending = statusLower === 'pending';
    const isAlreadyPending =
        isPending ||
        isSubmittedForApprovalState ||
        (isDraft && asset.actionRequiredBy);
    const isAssignmentAcknowledgmentPending = isAssetAssignmentAcknowledgmentPending(asset);
    const isAwaitingCreationApproval =
        isSubmittedForApprovalState ||
        (isDraft && asset.actionRequiredBy != null) ||
        (isPending && asset.actionRequiredBy != null && !isAssignmentAcknowledgmentPending);
    const isWorkflowPendingBlockingAssign =
        isSubmittedForApprovalState ||
        (isDraft && asset.actionRequiredBy != null) ||
        (isPending && asset.actionRequiredBy != null && !isAssignmentAcknowledgmentPending) ||
        !!asset?.pendingAction;

    const evaluated = actions
        .filter((action) => shouldIncludeHeaderAction(action, asset))
        .map((action, index) => {
            const isActionBtn = action.label === 'Loss and Damage' || action.label === 'End of life';
            const isLossDamageBtn = action.label === 'Loss and Damage';
            const isEditBtn = action.label === 'Edit Asset';
            const isDeleteBtn = action.label === 'Delete Asset';
            const isReturnAssetBtn = action.label === 'Return Asset';
            const isRequestOnDutyBtn = action.label === 'Request On Duty';
            const isConfirmOnDutyBtn = action.label === 'Confirm On Duty';
            const isServiceBtn = action.label === 'Service';
            const isExtendServiceBtn = action.label === 'Extend Service';
            const isTransferReassignBtn = action.label === 'TRANSFER ASSET';

            const isCompanyAsset = asset?.assignedToType === 'Company' && asset?.assignedCompany;
            const isUnassigned = !(asset?.assignedTo || isCompanyAsset);
            const canHRActOnCompany = isCompanyAsset && ctx.effectiveIsHR;
            const centralizedAction = mapHeaderLabelToAssetAction(action.label);
            const isCreationWorkflowState =
                isDraft ||
                isSubmittedForApprovalState ||
                statusLower === 'rejected' ||
                isAwaitingCreationApproval;
            const centralizedPermission =
                centralizedAction && assetActionUser && !isCreationWorkflowState
                    ? canPerformAssetAction(assetActionUser, asset, centralizedAction)
                    : null;

            let hasPermission = false;
            if (centralizedPermission != null) {
                hasPermission = centralizedPermission;
            } else if (isEditBtn) {
                if (isSubmittedForApprovalState) {
                    hasPermission = isAuthorized && !(isCompanyAsset && ctx.effectiveIsHR);
                    if (isCreator) hasPermission = false;
                } else if (isSaveOnlyDraft) {
                    hasPermission = isCreator;
                } else if (isDraft) {
                    hasPermission = isCreator || isAuthorized;
                } else if (statusLower === 'rejected') {
                    hasPermission = isCreator || isAuthorized;
                } else {
                    hasPermission = isAuthorized && !(isCompanyAsset && ctx.effectiveIsHR);
                }
            } else if (isDeleteBtn) {
                if (isSubmittedForApprovalState) {
                    hasPermission = isAuthorized;
                } else if (statusLower === 'rejected') {
                    hasPermission = isCreator || isAuthorized;
                } else if (isSaveOnlyDraft) {
                    hasPermission = isCreator || isAuthorized;
                } else if (isAwaitingCreationApproval) {
                    hasPermission = isCreator || isAuthorized || isAssignedUser || canHRActOnCompany;
                } else {
                    hasPermission =
                        isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate || canHRActOnCompany;
                }
            } else if (isRequestOnDutyBtn) {
                hasPermission = isAuthorized || isAssignedUser;
            } else if (isConfirmOnDutyBtn) {
                hasPermission = false;
            } else if (isExtendServiceBtn) {
                hasPermission = isAuthorized;
            } else if (isServiceBtn) {
                hasPermission = isAuthorized || isAssignedUser || canHRActOnCompany;
            } else if (isReturnAssetBtn) {
                hasPermission = isUnassigned
                    ? isAuthorized || isAssignerUser || canHRActOnCompany
                    : isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate || canHRActOnCompany;
            } else if (isTransferReassignBtn || action.label === 'Transfer') {
                hasPermission = isAuthorized || isAssignedUser;
            } else if (isActionBtn && isAwaitingCreationApproval) {
                hasPermission = isAuthorized;
                if (isSubmittedForApprovalState && isCreator && isLossDamageBtn) {
                    hasPermission = false;
                }
            } else {
                if (isUnassigned) {
                    hasPermission = isAuthorized;
                } else {
                    hasPermission =
                        isAuthorized || isAssignedUser || isAssignerUser || isPrimaryReporteeDelegate || canHRActOnCompany;
                }
            }

            if (isDraft && !isEditBtn && !isDeleteBtn) {
                hasPermission = false;
            }
            if (statusLower === 'rejected' && !isEditBtn && !isDeleteBtn) {
                hasPermission = false;
            }

            const isDisabled =
                action.disabled ||
                isOutOfService ||
                (isRequestOnDutyBtn && !!pendingOwnerOnDutyAcRequestId && isAssignedUser && !isAuthorized) ||
                (isLeaveActive(asset) &&
                    !isReturnAssetBtn &&
                    !isLossDamageBtn &&
                    !isRequestOnDutyBtn &&
                    !isConfirmOnDutyBtn &&
                    !isServiceBtn &&
                    !isExtendServiceBtn) ||
                isLost ||
                (isReturnAssetBtn && isUnassignedStatus) ||
                !hasPermission ||
                (isAssetDraftStatus && !isEditBtn && !isDeleteBtn) ||
                (isRejectedStatus && !(isCreator && (isEditBtn || isDeleteBtn))) ||
                (isEditBtn && isCreator && isSubmittedForApprovalState) ||
                (isLossDamageBtn && isCreator && isSubmittedForApprovalState) ||
                (isWorkflowPendingBlockingAssign && !isActionBtn && !isEditBtn) ||
                (isAlreadyPending && isActionBtn && !(isLossDamageBtn && isAwaitingCreationApproval && hasPermission));

            let displayLabel = action.displayLabel || action.label;
            if (isAlreadyPending && isActionBtn) {
                displayLabel = `${displayLabel} (PENDING...)`;
            } else if (isRequestOnDutyBtn && requestingOwnerOnDuty) {
                displayLabel = 'SENDING…';
            } else if (isRequestOnDutyBtn && pendingOwnerOnDutyAcRequestId && isAssignedUser && !isAuthorized) {
                displayLabel = 'ON DUTY (PENDING...)';
            } else if (isRequestOnDutyBtn && isAssignedUser && !isAuthorized) {
                displayLabel = pendingOwnerOnDutyReviewId ? 'CONFIRM ON DUTY' : 'REQUEST ON DUTY';
            } else if (isDeleteBtn && isDeleting) {
                displayLabel = 'DELETING...';
            } else if (isServiceBtn) {
                displayLabel = isServiceActive(asset) ? 'MARK LIVE' : action.displayLabel || 'SERVICE';
            }

            return {
                key: `${action.label}-${index}`,
                tier: action.tier || 'primary',
                label: action.label,
                displayLabel,
                disabled: isDisabled,
                onClick: action.onClick,
                loading: (isDeleteBtn && isDeleting) || (isRequestOnDutyBtn && requestingOwnerOnDuty),
                bgColor: isDeleteBtn && !isDisabled ? '#fee2e2' : undefined,
            };
        });

    return {
        primaryButtons: evaluated.filter((a) => a.tier === 'primary'),
        otherButtons: evaluated.filter((a) => a.tier === 'other'),
    };
}
