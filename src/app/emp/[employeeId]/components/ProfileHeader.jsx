'use client';

import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { getInitials } from '../utils/helpers';
import {
    getEmployeeProfilePictureSrc,
    hasPendingProfilePictureChange,
    toNextImageProfileSrc,
} from '@/utils/employeeProfileImage';
import { useToast } from '@/hooks/use-toast';
import DocumentViewerModal from './modals/DocumentViewerModal';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { Camera } from 'lucide-react';
import { filterSnapshotRowsToChangesOnly } from '../utils/pendingActivationSnapshotRows';
import PendingChangeSnapshotTable from './PendingChangeSnapshotTable';
import EmployeeHeroCardBackground from './EmployeeHeroCardBackground';
import {
    canViewerReviewEmployeeActivationAsHr,
    employeePendingChangesForViewer,
    filterProfilePendingInCurrentSubmission,
    isEmployeeProfileActivated,
    isEmployeeProfileApprovalSubmitted,
} from '@/utils/employeeActivationSections';
import { resolveContractJoiningDate, resolveProbationStartDate, calculateRemainingProbation, getProbationAwareDisplayStatus } from '@/utils/employeeWorkDetailsValidation';
import { isAdmin } from '@/utils/permissions';
import { isEmployeeLeftUser } from '@/utils/employeeWorkStatus';
import { mapPendingReactivationEntriesWithIds } from '@/utils/pendingReactivationEntryId';
import { buildActivationHoldPayload } from '@/utils/buildActivationHoldPayload';

function ModalPortal({ children }) {
    if (typeof document === 'undefined') return null;
    return createPortal(children, document.body);
}

function ProfileHeader({
    employee,
    imageError: imageErrorProp,
    setImageError: setImageErrorProp,
    handleFileSelect,
    profileCompletion,
    showProgressTooltip,
    setShowProgressTooltip,
    pendingFields,
    canSendForApproval,
    handleSubmitForApproval,
    sendingApproval,
    awaitingApproval,
    handleActivateProfile,
    handleHoldProfile,
    handleRejectProfile,
    activatingProfile,
    profileApproved,
    isPrimaryReportee,
    canReviewProfileActivation = false,
    viewerIsDesignatedFlowchartHr = false,
    onViewRequestedChange,
    canReviewProbationRequest = false,
    probationActionLabel = 'Make Permanent',
    probationActionLoading = false,
    onReviewProbation,
    onReturnUser,
    returnUserLoading = false,
    onTogglePortalAccess,
    togglingPortalAccess,
    canTogglePortal = false, // Default to false
    extraContent,
    hideProgressBar = false,
    hideStatusToggle = false,
    hideRole = false,
    hideContactNumber = false,
    hideEmail = false,
    enlargeProfilePic = false,
    showNameUnderProfilePic = false,
    subtitle = null,
    statusLabel = null,
    hideEmployeeStatus = false,
    viewerIsProfileSubject = false,
    viewerCanSeePendingActivationQueue = false,
    viewerCanFixActivationHold = false,
    hasProfileActivationHoldPending = false,
    onOpenActivationHoldReview = null,
    activationHoldResubmitEligible = false,
    canReviewHeldPendingsAsHod = false,
    onOpenHeldPendingsReview = null,
    employmentStyleBackground = false,
    canViewActivation = true,
    canCreateActivation = true,
    snapshotResolveContext = null,
    className = '',
    compactHeader = false,
    stackProfileWithExtra = false,
}) {
    const [internalImageError, setInternalImageError] = useState(false);
    const imageError = imageErrorProp ?? internalImageError;
    const setImageError = setImageErrorProp ?? setInternalImageError;
    const employeeImageKey = employee?._id || employee?.employeeId || '';

    useEffect(() => {
        if (setImageErrorProp) {
            setImageErrorProp(false);
        } else {
            setInternalImageError(false);
        }
    }, [employeeImageKey, setImageErrorProp]);

    const { toast } = useToast();
    const canActOnProfileActivation = canViewerReviewEmployeeActivationAsHr(employee, {
        canReviewProfileActivation:
            canReviewProfileActivation || viewerIsDesignatedFlowchartHr || isAdmin(),
    });
    const visiblePendingChanges = useMemo(
        () => employeePendingChangesForViewer(employee, viewerCanSeePendingActivationQueue),
        [employee?.pendingReactivationChanges, viewerCanSeePendingActivationQueue],
    );
    const profileActivated = useMemo(
        () => profileApproved || isEmployeeProfileActivated(employee),
        [profileApproved, employee?.profileStatus, employee?.profileApprovalStatus, employee?.profileWorkflow],
    );
    const hasPendingActivationChanges = visiblePendingChanges.length > 0;
    const isFirstActivationAwaitingHr =
        isEmployeeProfileApprovalSubmitted(employee) &&
        String(employee?.profileStatus || 'inactive').toLowerCase() === 'inactive';
    const showHrActivationReviewButton =
        canActOnProfileActivation && (hasPendingActivationChanges || isFirstActivationAwaitingHr);
    const showSubmitActivationButton =
        canSendForApproval &&
        (!canActOnProfileActivation || !isEmployeeProfileApprovalSubmitted(employee));
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showActivationModal, setShowActivationModal] = useState(false);
    const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);
    const [rejectAllReason, setRejectAllReason] = useState('');
    /** Per display-group keyed notes for unchecked queued changes (persisted on hold). */
    const [activationHoldRowNotesByGroup, setActivationHoldRowNotesByGroup] = useState({});
    const [selectedChangeIds, setSelectedChangeIds] = useState([]);
    const [isDirectHrAction, setIsDirectHrAction] = useState(false);
    const [viewingChange, setViewingChange] = useState(null);
    const [viewingDocument, setViewingDocument] = useState(null);
    const openAttachmentPreview = async (attachment, label = 'Attachment') => {
        const result = await openAttachmentInNewTab(attachment, { name: label });
        if (!result.ok) {
            toast({
                variant: 'destructive',
                title: 'Cannot open attachment',
                description: result.error || 'The file could not be loaded.',
            });
        }
    };
    const pendingReactivationEntries = useMemo(() => {
        return mapPendingReactivationEntriesWithIds(visiblePendingChanges).map((entry) => ({
            ...entry,
            card: String(entry?.card || '').trim() || 'Profile change',
            changeType: String(entry?.changeType || '').trim(),
            section: String(entry?.section || '').trim(),
        }));
    }, [visiblePendingChanges]);

    /** Rows in the current HR submission (excludes local drafts not sent this time). */
    const scopedReviewEntries = useMemo(() => {
        if (isDirectHrAction) return pendingReactivationEntries;
        const status = String(employee?.profileApprovalStatus || 'draft').toLowerCase();
        if (status !== 'submitted') return pendingReactivationEntries;
        return filterProfilePendingInCurrentSubmission(
            pendingReactivationEntries,
            employee?.profileWorkflow,
        );
    }, [
        pendingReactivationEntries,
        employee?.profileWorkflow,
        employee?.profileApprovalStatus,
        isDirectHrAction,
    ]);

    /** Matches ActivationHoldReviewModal: every held queue row has been re-saved after hold. */
    const activationHoldAllResolved = useMemo(() => {
        const hold = employee?.profileActivationHold || null;
        const unapprovedIds = Array.isArray(hold?.unapprovedEntryIds) ? hold.unapprovedEntryIds.map(String) : [];
        if (unapprovedIds.length === 0) return true;
        const resolvedIds = new Set((hold?.resolvedEntryIds || []).map(String));
        return unapprovedIds.every((id) => resolvedIds.has(String(id)));
    }, [employee?.profileActivationHold]);

    /** Submitter fixing HR hold: keep yellow entry point; do not show header green — submit only inside hold modal. */
    const hideHeaderGreenDuringEmployeeHold = useMemo(
        () => Boolean(viewerCanFixActivationHold && hasProfileActivationHoldPending),
        [viewerCanFixActivationHold, hasProfileActivationHoldPending],
    );

    /** One row per section + change type (e.g. multiple passport updates → single card; backend IDs stay separate). */
    const pendingReactivationDisplayGroups = useMemo(() => {
        const byKey = new Map();
        for (const entry of scopedReviewEntries) {
            const sec = String(entry.section || '').toLowerCase().trim();
            const ct = String(entry.changeType || '').toLowerCase().trim();
            const cardSlug = String(entry.card || '').trim().toLowerCase();
            const key = sec ? `${sec}::${ct}` : `card::${cardSlug}::${ct}`;
            if (!byKey.has(key)) {
                byKey.set(key, { key, ids: [], entries: [] });
            }
            const g = byKey.get(key);
            g.ids.push(entry._id);
            g.entries.push(entry);
        }
        const groups = [...byKey.values()].map((g) => {
            const sorted = [...g.entries].sort(
                (a, b) => new Date(b?.changedAt || 0) - new Date(a?.changedAt || 0),
            );
            const rep = sorted[0];
            const n = g.ids.length;
            const editHint = n > 1 ? ` · ${n} edits` : '';
            return {
                ...g,
                representativeEntry: rep,
                displayLabel: `${rep.card}${rep.changeType ? ` (${rep.changeType})` : ''}${editHint}`,
                sortTime: Math.min(
                    ...g.entries.map((e) => {
                        const t = new Date(e?.changedAt || 0).getTime();
                        return Number.isNaN(t) ? Infinity : t;
                    }),
                ),
            };
        });
        groups.sort((a, b) => a.sortTime - b.sortTime);
        return groups;
    }, [scopedReviewEntries]);

    useEffect(() => {
        setActivationHoldRowNotesByGroup((prev) => {
            const next = { ...prev };
            let dirty = false;
            const sel = new Set(selectedChangeIds.map(String));
            pendingReactivationDisplayGroups.forEach((g) => {
                const fully = g.ids.length > 0 && g.ids.every((id) => sel.has(String(id)));
                if (fully && next[g.key]) {
                    delete next[g.key];
                    dirty = true;
                }
            });
            return dirty ? next : prev;
        });
    }, [selectedChangeIds, pendingReactivationDisplayGroups]);

    const selectedChangeIdSet = useMemo(
        () => new Set(selectedChangeIds.map(String)),
        [selectedChangeIds],
    );

    const queuedChangeIdCount = scopedReviewEntries.length;
    const allSelected =
        queuedChangeIdCount > 0 &&
        scopedReviewEntries.every((e) => selectedChangeIdSet.has(String(e._id)));

    const activationSubjectDisplayName = useMemo(() => {
        const n = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim();
        if (n) return n;
        if (employee?.employeeId) return String(employee.employeeId).trim();
        return 'this employee';
    }, [employee?.firstName, employee?.lastName, employee?.employeeId]);

    const activationRequestDetails = useMemo(() => {
        const workflow = Array.isArray(employee?.profileWorkflow) ? employee.profileWorkflow : [];
        const hrEntries = workflow
            .filter((w) => String(w?.role || '').toLowerCase() === 'hr')
            .slice()
            .sort((a, b) => new Date(b?.assignedAt || 0) - new Date(a?.assignedAt || 0));
        const submittedEntry = hrEntries.find((e) => e?.status === 'submitted') || hrEntries[0] || null;
        const rawComment = typeof submittedEntry?.comment === 'string' ? submittedEntry.comment : '';

        const parseFallback = (text) => {
            if (!text || typeof text !== 'string') return { reason: '', description: '', attachment: '', requestedChanges: [] };
            const reasonMatch = text.match(/Reason:\s*(.*?)(\s*\|\s*Description:|\s*\|\s*Attachment:|$)/i);
            const descriptionMatch = text.match(/Description:\s*(.*?)(\s*\|\s*Attachment:|$)/i);
            const attachmentMatch = text.match(/Attachment:\s*(.*)$/i);
            const requestedChangesMatch = text.match(/Requested Changes:\s*(.*?)(\s*\|\s*Attachment:|$)/i);
            return {
                reason: reasonMatch?.[1]?.trim() || text.trim(),
                description: descriptionMatch?.[1]?.trim() || '',
                attachment: attachmentMatch?.[1]?.trim() || '',
                requestedChanges: (requestedChangesMatch?.[1] || '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            };
        };

        const fallback = parseFallback(rawComment);
        const structuredRequested = String(submittedEntry?.description || '')
            .match(/Requested Changes:\s*(.*)$/i)?.[1] || '';
        return {
            reason: (submittedEntry?.reason || '').trim() || fallback.reason,
            description: (submittedEntry?.description || '').trim() || fallback.description,
            attachment: (submittedEntry?.attachment || '').trim() || fallback.attachment,
            attachmentName: (submittedEntry?.attachmentName || '').trim(),
            requestedChanges: structuredRequested
                ? structuredRequested.split(',').map((s) => s.trim()).filter(Boolean)
                : fallback.requestedChanges,
        };
    }, [employee?.profileWorkflow]);

    const openActivationReview = (isDirect = false) => {
        setIsDirectHrAction(isDirect);
        const scope =
            isDirect
                ? pendingReactivationEntries
                : filterProfilePendingInCurrentSubmission(
                      pendingReactivationEntries,
                      employee?.profileWorkflow,
                  );
        setSelectedChangeIds(scope.map((entry) => entry._id));
        setActivationHoldRowNotesByGroup({});
        setShowRejectAllConfirm(false);
        setRejectAllReason('');
        setShowActivationModal(true);
    };

    const handleActivationRejectAll = async () => {
        if (activatingProfile) return;
        const reason = String(rejectAllReason || '').trim();
        if (!reason) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Enter a reason before rejecting all pending changes.',
            });
            return;
        }
        const ok = await handleRejectProfile(reason);
        if (ok) {
            setShowActivationModal(false);
            setShowRejectAllConfirm(false);
            setRejectAllReason('');
            setActivationHoldRowNotesByGroup({});
        }
    };

    const handleActivationOk = async () => {
        if (activatingProfile) return;
        try {
            const holdPayload = buildActivationHoldPayload({
                employee,
                profileWorkflow: employee?.profileWorkflow,
                selectedChangeIds,
                activationHoldRowNotesByGroup,
                pendingReactivationDisplayGroups,
            });
            const { scopeIds, approvedChangeIds, rowNotesByEntryId, uncheckedWithoutNotes } = holdPayload;
            const selectedSet = new Set(selectedChangeIds.map(String));
            const fullApprove = scopeIds.length === 0 || scopeIds.every((id) => selectedSet.has(id));

            if (!fullApprove) {
                if (uncheckedWithoutNotes.length > 0) {
                    const labels = uncheckedWithoutNotes
                        .map((e) => String(e.card || e.section || 'Change').trim())
                        .filter(Boolean);
                    const missingNoteGroup = pendingReactivationDisplayGroups.find((g) => {
                        const unchecked = g.ids.filter((id) => !selectedChangeIdSet.has(String(id)));
                        if (!unchecked.length) return false;
                        const note = String(activationHoldRowNotesByGroup[g.key] || '').trim();
                        return !note;
                    });
                    toast({
                        title: 'Instructions required',
                        description:
                            labels.length > 1
                                ? `Add instructions for unchecked items: ${labels.join(', ')}.`
                                : `Add instructions for "${missingNoteGroup?.displayLabel || labels[0] || 'unchecked items'}" before clicking OK.`,
                        variant: 'destructive',
                    });
                    if (missingNoteGroup) {
                        const noteId = `activation-hold-note-${missingNoteGroup.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                        document.getElementById(noteId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        document.getElementById(noteId)?.focus();
                    }
                    return;
                }
                const ok = await handleHoldProfile(approvedChangeIds, '', rowNotesByEntryId);
                if (ok) {
                    setShowActivationModal(false);
                    setActivationHoldRowNotesByGroup({});
                }
                return;
            }

            const idsForActivate = scopeIds.filter((id) => selectedSet.has(String(id)));
            const ok = await handleActivateProfile(idsForActivate, { directHr: isDirectHrAction });
            if (ok) {
                setShowActivationModal(false);
                setActivationHoldRowNotesByGroup({});
            }
        } catch (error) {
            console.error('Profile activation OK failed:', error);
            toast({
                variant: 'destructive',
                title: 'Could not complete review',
                description: error?.message || 'Something went wrong while processing this request.',
            });
        }
    };
    const toggleChangeGroupSelection = (groupIds) => {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return;
        const normalized = groupIds.map(String);
        setSelectedChangeIds((prev) => {
            const prevSet = new Set(prev.map(String));
            const allIn = normalized.every((id) => prevSet.has(id));
            if (allIn) {
                const remove = new Set(normalized);
                return prev.filter((x) => !remove.has(String(x)));
            }
            return [...new Set([...prev.map(String), ...normalized])];
        });
    };
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedChangeIds([]);
            return;
        }
        setSelectedChangeIds(scopedReviewEntries.map((entry) => entry._id));
    };
    const [isOnDuty, setIsOnDuty] = useState(true); // Static UI state for "On Duty" / "Leave" toggle
    // ... existing code ...

    const [isTooltipLocked, setIsTooltipLocked] = useState(false);
    const tooltipRef = useRef(null);
    const progressBarRef = useRef(null);

    const displayWorkStatus = useMemo(
        () => getProbationAwareDisplayStatus(employee),
        [employee?.status, employee?.probationPeriod, employee?.contractJoiningDate, employee?.visaDetails, employee?.pendingReactivationChanges],
    );

    // Calculate remaining probation duration
    const remainingProbation = useMemo(() => {
        const info = calculateRemainingProbation({
            status: 'Probation',
            contractJoiningDate: resolveProbationStartDate(employee),
            probationPeriod: employee?.probationPeriod || 6,
            employee,
        });
        if (!info) return null;
        return {
            months: info.months,
            days: info.days,
            expired: info.isOver,
        };
    }, [employee?.status, employee?.probationPeriod, employee?.contractJoiningDate, employee?.visaDetails, employee?.pendingReactivationChanges]);

    // Group pending fields by section for the modal
    const groupedPendingFields = useMemo(() => {
        if (!pendingFields) return {};
        return pendingFields.reduce((acc, item) => {
            if (!acc[item.section]) {
                acc[item.section] = [];
            }
            acc[item.section].push(item.field);
            return acc;
        }, {});
    }, [pendingFields]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isTooltipLocked &&
                tooltipRef.current && !tooltipRef.current.contains(event.target) &&
                progressBarRef.current && !progressBarRef.current.contains(event.target)) {
                setIsTooltipLocked(false);
                setShowProgressTooltip(false);
            }
        };

        if (isTooltipLocked) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTooltipLocked]);

    const handleTooltipClose = () => {
        if (!isTooltipLocked) {
            setShowProgressTooltip(false);
        }
    };

    const toggleTooltipLock = (e) => {
        e.stopPropagation();
        setIsTooltipLocked(!isTooltipLocked);
        if (!isTooltipLocked) {
            setShowProgressTooltip(true);
        }
    };

    const heroShell = employmentStyleBackground && !enlargeProfilePic;
    const useStackedFineLayout = stackProfileWithExtra && showNameUnderProfilePic && extraContent;
    const heroToneClass =
        '[&_h1]:!text-white [&_h2]:!text-white [&_.text-gray-800]:!text-white [&_.text-gray-700]:!text-white [&_.text-gray-600]:!text-white/90 [&_.text-gray-500]:!text-white/85 [&_.text-blue-600]:!text-sky-950 [&_.bg-blue-50]:!bg-white/95 [&_.border-blue-100]:!border-white/50 [&_.border-gray-100]:!border-white/25 [&_.bg-gray-100]:!bg-white/15 [&_.bg-gray-200]:!bg-white/30 [&_svg]:!text-white [&_svg]:!stroke-white';

    return (
        <div
            className={`lg:col-span-1 relative h-full w-full min-w-0 ${className} ${heroShell
                    ? 'flex flex-col overflow-hidden rounded-2xl shadow-md text-white'
                    : `rounded-xl bg-white shadow-sm ${enlargeProfilePic ? 'flex flex-row p-0' : `flex flex-col ${compactHeader ? 'p-4' : 'p-6'}`} ${compactHeader ? 'overflow-hidden' : 'overflow-y-auto'}`
                }`}
        >
            {heroShell ? <EmployeeHeroCardBackground /> : null}

            <div
                className={
                    heroShell
                        ? `relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto p-6 ${heroToneClass}`
                        : 'contents'
                }
            >
                {/* Main Content Container: Flex row if enlarge, else standard block inside flex-col */}
                <div className={`flex w-full min-w-0 ${useStackedFineLayout ? 'flex-col items-stretch gap-3' : enlargeProfilePic ? 'flex-row items-stretch' : compactHeader ? 'items-start gap-3' : 'items-start gap-4 sm:gap-6'}`}>

                    {/* Profile Picture Section */}
                    <div className={`flex flex-col items-center gap-3 flex-shrink-0 ${enlargeProfilePic ? 'w-1/4 bg-gray-50 border-r border-gray-100' : ''}`}>
                        {/* ... existing profile pic code ... */}
                        <div className="relative group w-full h-full">
                            <div className={`${enlargeProfilePic ? 'w-full h-full rounded-none border-none' : `${compactHeader ? 'w-28 h-32' : 'w-40 h-45'} rounded-2xl border-4 border-gray-200 shadow-xl`} overflow-hidden bg-slate-100 relative group/pic transition-all duration-500`}>
                                {(() => {
                                    const safeUrl = toNextImageProfileSrc(getEmployeeProfilePictureSrc(employee));
                                    const pendingProfilePic = hasPendingProfilePictureChange(employee);

                                    return (safeUrl && !imageError) ? (
                                        <>
                                        <Image
                                            src={safeUrl}
                                            alt={`${employee.firstName} ${employee.lastName}`}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover/pic:scale-110"
                                            onError={() => setImageError(true)}
                                            sizes={enlargeProfilePic ? "25vw" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
                                            priority={true}
                                            unoptimized
                                        />
                                        {pendingProfilePic && (
                                            <span
                                                className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                                                title="Profile picture waiting for HR approval"
                                            >
                                                !
                                            </span>
                                        )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-4xl font-black uppercase tracking-tighter">
                                            {getInitials(employee.firstName, employee.lastName)}
                                        </div>
                                    );
                                })()}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/pic:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                    <button
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = handleFileSelect;
                                            input.click();
                                        }}
                                        className="w-12 h-12 bg-white/90 backdrop-blur-sm text-blue-600 rounded-2xl flex items-center justify-center shadow-2xl transform translate-y-4 group-hover/pic:translate-y-0 transition-all duration-300 hover:bg-blue-600 hover:text-white"
                                        title="Update Profile Picture"
                                    >
                                        <Camera size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Status Config for Enlarged Mode */}
                            {!enlargeProfilePic && (
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
                                    <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                                </div>
                            )}
                        </div>

                        {/* On Duty / Leave Static Toggle (Only show if NOT hidden AND NOT Enlarged - if enlarged we might want it elsewhere or hidden as per user req for reward page) */}
                        {!hideStatusToggle && !enlargeProfilePic && (
                            <div
                                className={
                                    heroShell
                                        ? 'bg-white/[0.12] border border-white/25 p-1 rounded-lg flex items-center w-32'
                                        : 'bg-gray-100 p-1 rounded-lg flex items-center w-32'
                                }
                            >
                                <button
                                    onClick={() => setIsOnDuty(true)}
                                    type="button"
                                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all text-center ${heroShell ? (isOnDuty ? 'bg-white text-[#0095DD] shadow-sm' : 'text-white/90 hover:bg-white/[0.08]') : (isOnDuty ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}`}
                                >
                                    On Duty
                                </button>
                                <button
                                    onClick={() => setIsOnDuty(false)}
                                    type="button"
                                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all text-center ${heroShell ? (!isOnDuty ? 'bg-white text-[#0095DD] shadow-sm' : 'text-white/90 hover:bg-white/[0.08]') : (!isOnDuty ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}`}
                                >
                                    Leave
                                </button>
                            </div>
                        )}

                        {/* Name and Status - Conditional placement under Profile Pic */}
                        {showNameUnderProfilePic && (
                            <div className="flex flex-col items-center gap-2 text-center mt-3">
                                <h1 className="text-lg font-black text-gray-800 leading-tight">
                                    {employee.firstName} {employee.lastName}
                                </h1>
                                <div className="flex flex-col items-center gap-1.5">
                                    {subtitle && (
                                        <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100 uppercase tracking-wider">{subtitle}</p>
                                    )}
                                    {statusLabel && (
                                        <p className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm mt-1
                                        ${statusLabel.includes('Approved')
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'}
                                    `}>
                                            {statusLabel}
                                        </p>
                                    )}
                                </div>
                                {displayWorkStatus && !hideEmployeeStatus && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {profileActivated && (
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                                Active
                                            </span>
                                        )}
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${displayWorkStatus === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                            displayWorkStatus === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                                displayWorkStatus === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                                    displayWorkStatus === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                        employee.profileApprovalStatus === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                            'bg-gray-100 text-gray-700'
                                            }`}>
                                            {employee.profileApprovalStatus === 'rejected' ? 'Activation Rejected' :
                                                (displayWorkStatus === 'Notice' ? (employee.noticeRequest?.reason || 'Notice') : displayWorkStatus)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={`flex-1 min-w-0 w-full ${enlargeProfilePic ? 'p-6 flex flex-col justify-center' : ''}`}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex flex-col gap-2">
                                {!showNameUnderProfilePic && (
                                    <>
                                        <h1 className={`${compactHeader ? 'text-xl' : 'text-2xl'} font-black text-gray-800`}>
                                            {employee.firstName} {employee.lastName}
                                        </h1>
                                        <div className="flex flex-col gap-1.5">
                                            {subtitle && (
                                                <p className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100 uppercase tracking-wider w-fit">{subtitle}</p>
                                            )}
                                            {statusLabel && (
                                                <p className={`text-[11px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full border shadow-sm w-fit mt-1
                                                ${statusLabel.includes('Approved')
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'}
                                            `}>
                                                    {statusLabel}
                                                </p>
                                            )}
                                        </div>
                                        {displayWorkStatus && !hideEmployeeStatus && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {profileActivated && (
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                                        Active
                                                    </span>
                                                )}
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${displayWorkStatus === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                                    displayWorkStatus === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                                        displayWorkStatus === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                                            displayWorkStatus === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                                employee.profileApprovalStatus === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                    'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {employee.profileApprovalStatus === 'rejected' ? 'Activation Rejected' :
                                                        (displayWorkStatus === 'Notice' ? (employee.noticeRequest?.reason || 'Notice') : displayWorkStatus)}
                                                </span>
                                                {displayWorkStatus === 'Notice' && employee.noticeRequest?.duration && (
                                                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                                        {employee.noticeRequest.duration}
                                                    </span>
                                                )}
                                                {displayWorkStatus === 'Notice' && employee.noticeRequest?.exitDate && (
                                                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                                        Exit: {new Date(employee.noticeRequest.exitDate).toLocaleDateString('en-GB', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </span>
                                                )}
                                                {displayWorkStatus === 'Probation' && remainingProbation && !remainingProbation.expired && (
                                                    <span className="px-2 py-1 rounded text-xs font-medium bg-[#3B82F6]/10 text-[#1D4ED8] border border-[#3B82F6]/20">
                                                        {remainingProbation.months > 0 && `${remainingProbation.months} Month${remainingProbation.months !== 1 ? 's' : ''}`}
                                                        {remainingProbation.months > 0 && remainingProbation.days > 0 && ' and '}
                                                        {remainingProbation.days > 0 && `${remainingProbation.days} Day${remainingProbation.days !== 1 ? 's' : ''}`} Remaining
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* Approval Button near Status — shrink-0 / wrap so a second pill never sits on top of the green action */}
                            <div className="flex flex-wrap items-center justify-end gap-2 min-w-0 shrink-0">
                                {isAdmin() && isEmployeeLeftUser(employee) ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onReturnUser) onReturnUser();
                                        }}
                                        disabled={returnUserLoading}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {returnUserLoading ? 'Processing...' : 'Return User'}
                                    </button>
                                ) : null}
                                {canReviewProbationRequest ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onReviewProbation) onReviewProbation();
                                        }}
                                        disabled={probationActionLoading}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {probationActionLoading ? 'Processing...' : probationActionLabel}
                                    </button>
                                ) : null}
                                {showSubmitActivationButton &&
                                            (!awaitingApproval || activationHoldResubmitEligible) &&
                                            (!hasProfileActivationHoldPending ||
                                                activationHoldAllResolved ||
                                                !viewerCanFixActivationHold) &&
                                            !hideHeaderGreenDuringEmployeeHold &&
                                            canViewActivation && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!canCreateActivation) {
                                                            toast({
                                                                variant: "destructive",
                                                                title: "Restricted",
                                                                description: "You are restricted to create/approve activations."
                                                            });
                                                            return;
                                                        }
                                                        handleSubmitForApproval();
                                                    }}
                                                    disabled={sendingApproval || !canCreateActivation}
                                                    className={`relative z-10 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0`}
                                                    title={!canCreateActivation ? "You are restricted to create activations" : ""}
                                                >
                                                    {sendingApproval
                                                        ? isAdmin()
                                                            ? 'Submitting...'
                                                            : 'Sending...'
                                                        : isAdmin() && profileActivated && hasPendingActivationChanges
                                                          ? 'Submit for approval'
                                                          : profileActivated && hasPendingActivationChanges
                                                            ? 'Submit pending'
                                                            : employee.profileApprovalStatus === 'rejected' ||
                                                                activationHoldResubmitEligible
                                                              ? 'Resubmit for Activation'
                                                              : isAdmin()
                                                                ? 'Submit for approval'
                                                                : 'Send for Activation'}
                                                </button>
                                            )}
                                        {awaitingApproval &&
                                            (hasPendingActivationChanges ||
                                                hasProfileActivationHoldPending ||
                                                !profileActivated) && (
                                            <>
                                                {showHrActivationReviewButton ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openActivationReview(false);
                                                        }}
                                                        disabled={activatingProfile}
                                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        {activatingProfile
                                                            ? 'Processing...'
                                                            : hasProfileActivationHoldPending
                                                                ? 'Review pendings · on hold'
                                                                : isFirstActivationAwaitingHr && !hasPendingActivationChanges
                                                                  ? 'Review activation'
                                                                  : 'Review pendings'}
                                                    </button>
                                                ) : canReviewHeldPendingsAsHod && onOpenHeldPendingsReview && canViewActivation && hasPendingActivationChanges ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!canCreateActivation) {
                                                                toast({
                                                                    variant: "destructive",
                                                                    title: "Restricted",
                                                                    description: "You are restricted to create/approve activations."
                                                                });
                                                                return;
                                                            }
                                                            onOpenHeldPendingsReview();
                                                        }}
                                                        disabled={activatingProfile || !canCreateActivation}
                                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        title={!canCreateActivation ? "You are restricted to create activations" : "Open the list of changes HR kept on hold for this employee."}
                                                    >
                                                        {activatingProfile ? 'Processing...' : 'Review pendings · on hold'}
                                                    </button>
                                                ) : viewerCanFixActivationHold &&
                                                    hasProfileActivationHoldPending &&
                                                    hasPendingActivationChanges &&
                                                    onOpenActivationHoldReview && canViewActivation ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!canCreateActivation) {
                                                                toast({
                                                                    variant: "destructive",
                                                                    title: "Restricted",
                                                                    description: "You are restricted to create/approve activations."
                                                                });
                                                                return;
                                                            }
                                                            onOpenActivationHoldReview();
                                                        }}
                                                        disabled={activatingProfile || !canCreateActivation}
                                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap bg-amber-500 text-white hover:bg-amber-600 border border-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        title={
                                                            !canCreateActivation
                                                                ? "You are restricted to create activations"
                                                                : activationHoldAllResolved
                                                                    ? 'Open the hold checklist — submit for activation to HR from here'
                                                                    : 'HR placed your activation on hold — open the checklist and fix red items'
                                                        }
                                                    >
                                                        {activatingProfile
                                                            ? 'Processing...'
                                                            : activationHoldAllResolved
                                                                ? 'Activation on hold — submit to HR'
                                                                : 'Activation on hold — fix items'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled
                                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed max-w-[11rem] truncate shrink-0"
                                                        title="Only the assigned HR reviewer or the employee who submitted for activation sees actions while awaiting activation."
                                                    >
                                                        Waiting for HR
                                                    </button>
                                                )}
                                            </>
                                        )}
                            </div>
                        </div>
                        {!hideRole && (
                            <p className={`text-gray-600 ${compactHeader ? 'mb-1 text-sm' : 'mb-3'}`}>{employee.role || employee.designation || 'Employee'}</p>
                        )}

                        {extraContent}



                        {/* Contact Info */}
                        {(employee.contactNumber || employee.companyEmail || employee.workEmail) && (
                            <div className={`space-y-1 ${compactHeader ? 'mb-2' : 'mb-4'}`}>
                                {employee.contactNumber && !hideContactNumber && (
                                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                        </svg>
                                        <span>{employee.contactNumber}</span>
                                    </div>
                                )}
                                {(employee.companyEmail || employee.workEmail) && !hideEmail && (
                                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                            <polyline points="22,6 12,13 2,6"></polyline>
                                        </svg>
                                        <span>{employee.companyEmail || employee.workEmail}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {onTogglePortalAccess && (
                            <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${compactHeader ? 'mt-2 pt-2' : 'mt-4 pt-4'} border-t border-gray-100`}>
                                <span className="text-sm font-medium text-gray-700">Portal Access</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (canTogglePortal) onTogglePortalAccess(!employee.enablePortalAccess);
                                    }}
                                    disabled={togglingPortalAccess || !canTogglePortal}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${employee.enablePortalAccess ? 'bg-blue-600' : 'bg-gray-200'
                                        } ${(togglingPortalAccess || !canTogglePortal) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${employee.enablePortalAccess ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                                <span className="text-xs text-gray-500">
                                    {employee.enablePortalAccess ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                        )}

                    </div>
                </div>

                {/* Profile Status */}
                {!hideProgressBar && (
                    <div className={compactHeader ? 'mt-3' : 'mt-6'}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Profile Status</span>
                            <span className="text-sm font-semibold text-gray-800">{profileCompletion}%</span>
                        </div>
                        <div
                            ref={progressBarRef}
                            className="relative w-full"
                            onMouseEnter={() => setShowProgressTooltip(true)}
                            onMouseLeave={handleTooltipClose}
                            onClick={toggleTooltipLock}
                        >
                            <div className="w-full bg-gray-200 rounded-full h-2.5 cursor-pointer">
                                <div
                                    className={`${heroShell ? 'bg-white' : 'bg-blue-600'} h-2.5 rounded-full transition-all duration-300`}
                                    style={{ width: `${profileCompletion}%` }}
                                ></div>
                            </div>

                            {/* Tooltip showing pending fields */}
                            {showProgressTooltip && pendingFields.length > 0 && !showPendingModal && (
                                <div
                                    ref={tooltipRef}
                                    className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 text-gray-700 text-xs rounded-lg shadow-lg border border-gray-200 p-3 z-50 backdrop-blur-sm cursor-default"
                                    onMouseEnter={() => setShowProgressTooltip(true)}
                                    onMouseLeave={handleTooltipClose}
                                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside tooltip
                                >
                                    <div className="font-semibold mb-2 text-sm text-gray-800 flex justify-between items-center">
                                        <span>Next to Complete:</span>
                                        <div className="flex items-center gap-2">
                                            {isTooltipLocked && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsTooltipLocked(false);
                                                        setShowProgressTooltip(false);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600"
                                                    title="Close tooltip"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            )}
                                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{pendingFields.length} Pending</span>
                                        </div>
                                    </div>

                                    {/* Show first 3 items */}
                                    <div className="flex flex-col gap-2 mb-2">
                                        {pendingFields.slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex flex-col">
                                                <span className="font-medium text-gray-600 text-[11px] uppercase tracking-wide">{item.section}:</span>
                                                <span className="text-gray-500 pl-1 border-l-2 border-gray-200">{item.field}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {pendingFields.length > 3 && (
                                        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                                            <span className="text-xs text-gray-400">+{pendingFields.length - 3} more fields</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowPendingModal(true);
                                                    setIsTooltipLocked(false);
                                                    setShowProgressTooltip(false);
                                                }}
                                                className="text-blue-600 hover:text-blue-700 font-medium text-xs hover:underline flex items-center"
                                            >
                                                See all
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1">
                                                    <path d="M9 18l6-6-6-6"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-4 transform translate-y-full">
                                        <div className="border-4 border-transparent border-t-white/95"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Pending Fields Modal */}
            {showPendingModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Complete Your Profile</h3>
                                <p className="text-sm text-gray-500 mt-0.5">You have {pendingFields.length} pending fields to complete</p>
                            </div>
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                            <div className="space-y-6">
                                {Object.entries(groupedPendingFields).map(([section, fields]) => (
                                    <div key={section} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            {section}
                                        </h4>
                                        <ul className="space-y-2">
                                            {fields.map((field, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 pl-4">
                                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span>
                                                    <span>{field}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-end">
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors shadow-sm cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Profile Activation Modal — portaled so OK is not clipped by profile card overflow */}
            {showActivationModal && (
                <ModalPortal>
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-8 py-5 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-800">Profile Activation</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Review and action the activation request for <strong>{activationSubjectDisplayName}</strong>.
                            </p>
                        </div>

                        <div className="px-8 py-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                            <div className="space-y-4 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-5">
                                {String(employee?.profileStatus || '').toLowerCase() === 'inactive' ? (
                                    <div className="p-1">
                                        <p className="text-sm font-medium text-gray-700">
                                            This is the first activation. You have to get HR approval to activate your profile. Now you are eligible for that. Submit to send for approval.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {!isDirectHrAction && (
                                            <>
                                                <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                                    {activationRequestDetails.reason || activationRequestDetails.description ? 'Submitted Request Details' : 'Direct HR Review'}
                                                </div>
                                                {(!activationRequestDetails.reason && !activationRequestDetails.description) ? (
                                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                                                        <p className="text-sm text-blue-800 font-medium italic">
                                                            You are reviewing pending changes as an HR administrator. You can directly approve these changes below.
                                                        </p>
                                                    </div>
                                                ) : null}
                                                {activationRequestDetails.attachment ? (
                                                    <div className="space-y-1">
                                                        <div className="text-xs font-semibold text-gray-700">Attachment</div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openAttachmentPreview(
                                                                    activationRequestDetails.attachment,
                                                                    activationRequestDetails.attachmentName || 'Attachment'
                                                                )
                                                            }
                                                            className="text-sm font-semibold text-blue-700 hover:underline break-all text-left"
                                                        >
                                                            {activationRequestDetails.attachmentName || 'View attachment'}
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </>
                                )}
                                {scopedReviewEntries.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-gray-700">Requested Changes</div>
                                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={toggleSelectAll}
                                                />
                                                {allSelected ? 'Deselect all' : 'Select all'}
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Check every row to fully approve on OK. Unchecked rows need instructions below — the submitter sees them on hold and in email.
                                        </p>
                                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                            {pendingReactivationDisplayGroups.map((group) => {
                                                const groupFullySelected =
                                                    group.ids.length > 0 &&
                                                    group.ids.every((id) => selectedChangeIdSet.has(String(id)));
                                                const groupHasUnchecked =
                                                    group.ids.length > 0 &&
                                                    group.ids.some((id) => !selectedChangeIdSet.has(String(id)));
                                                const groupPartiallySelected =
                                                    group.ids.some((id) => selectedChangeIdSet.has(String(id))) &&
                                                    !groupFullySelected;
                                                const entry = group.representativeEntry;
                                                return (
                                                    <div
                                                        key={group.key}
                                                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                                                    >
                                                        <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                            <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    ref={(el) => {
                                                                        if (el) {
                                                                            el.indeterminate = Boolean(
                                                                                groupPartiallySelected,
                                                                            );
                                                                        }
                                                                    }}
                                                                    checked={groupFullySelected}
                                                                    onChange={() => toggleChangeGroupSelection(group.ids)}
                                                                />
                                                                <span
                                                                    className="text-sm text-gray-800 truncate"
                                                                    title={group.displayLabel}
                                                                >
                                                                    {group.displayLabel}
                                                                </span>
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onViewRequestedChange?.(entry.card);
                                                                    setViewingChange(entry);
                                                                }}
                                                                className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                                                            >
                                                                Full compare
                                                            </button>
                                                        </div>
                                                        <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <PendingChangeSnapshotTable
                                                                entry={entry}
                                                                kind="previous"
                                                                title="Current card"
                                                                variant="gray"
                                                                resolveContext={snapshotResolveContext}
                                                            />
                                                            <PendingChangeSnapshotTable
                                                                entry={entry}
                                                                kind="proposed"
                                                                title="Edited card"
                                                                variant="blue"
                                                                resolveContext={snapshotResolveContext}
                                                            />
                                                        </div>
                                                        {groupHasUnchecked ? (
                                                            <div className="px-3 pb-2.5 pt-1 border-t border-gray-100 bg-slate-50/70">
                                                                <label className="text-xs font-semibold text-gray-600 block mb-1">
                                                                    Instructions for unchecked item{' '}
                                                                    <span className="text-red-500">*</span>
                                                                </label>
                                                                <textarea
                                                                    id={`activation-hold-note-${group.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                                                                    value={activationHoldRowNotesByGroup[group.key] || ''}
                                                                    onChange={(e) =>
                                                                        setActivationHoldRowNotesByGroup((prev) => ({
                                                                            ...prev,
                                                                            [group.key]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="What should be fixed for this section (mandatory for unchecked rows)"
                                                                    rows={2}
                                                                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y min-h-[52px]"
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {scopedReviewEntries.length > 0 && (
                                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                                    <span className="font-semibold">OK</span> with all rows checked fully approves and applies every card.
                                    With any row unchecked, checked cards are applied now and unchecked cards return to the submitter (dashboard task + email).
                                    Use <span className="font-semibold">Reject all</span> to send every pending change back to the submitter without applying updates.
                                </p>
                            )}
                            {showRejectAllConfirm && scopedReviewEntries.length > 0 ? (
                                <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-2">
                                    <p className="text-sm font-semibold text-red-800">
                                        Reject all pending changes
                                    </p>
                                    <p className="text-xs text-red-700">
                                        Nothing will be applied to the live profile. The submitter will receive the queue back with your reason.
                                    </p>
                                    <textarea
                                        value={rejectAllReason}
                                        onChange={(e) => setRejectAllReason(e.target.value)}
                                        placeholder="Reason for rejection (required)"
                                        rows={3}
                                        className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-y"
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="px-8 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-2 border-t border-gray-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowActivationModal(false);
                                    setShowRejectAllConfirm(false);
                                    setRejectAllReason('');
                                    setActivationHoldRowNotesByGroup({});
                                }}
                                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
                                disabled={activatingProfile}
                            >
                                Cancel
                            </button>
                            {scopedReviewEntries.length > 0 && !isDirectHrAction ? (
                                showRejectAllConfirm ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleActivationRejectAll()}
                                        disabled={activatingProfile}
                                        className="px-4 py-2 rounded-xl border border-red-300 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {activatingProfile ? 'Rejecting…' : 'Confirm reject all'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowRejectAllConfirm(true)}
                                        disabled={activatingProfile}
                                        className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Reject all
                                    </button>
                                )
                            ) : null}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleActivationOk();
                                }}
                                disabled={activatingProfile}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {activatingProfile ? 'Processing…' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}
            {viewingChange && (() => {
                const { previousRows: diffPrevRows, proposedRows: diffPropRows } = filterSnapshotRowsToChangesOnly(viewingChange);
                return (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-800">{viewingChange.card}</h3>
                                <button
                                    onClick={() => setViewingChange(null)}
                                    className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Current Card</div>
                                    <div className="rounded-lg border bg-gray-50 overflow-hidden">
                                        {diffPrevRows.length > 0 ? (
                                            diffPrevRows.map((row, idx) => (
                                                <div key={`old-${idx}`} className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-gray-200 last:border-b-0">
                                                    <div className="col-span-4 text-sm font-semibold text-gray-700">{row.label}</div>
                                                    <div className="col-span-8 text-sm text-gray-800 break-all flex items-center justify-between gap-3">
                                                        <span>{row.value}</span>
                                                        {row.url ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAttachmentPreview(row.url, row.label)}
                                                                className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-gray-500">No current data.</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Edited Card</div>
                                    <div className="rounded-lg border border-blue-100 bg-blue-50 overflow-hidden">
                                        {diffPropRows.length > 0 ? (
                                            diffPropRows.map((row, idx) => (
                                                <div key={`new-${idx}`} className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-blue-100 last:border-b-0">
                                                    <div className="col-span-4 text-sm font-semibold text-blue-800">{row.label}</div>
                                                    <div className="col-span-8 text-sm text-blue-900 break-all flex items-center justify-between gap-3">
                                                        <span>{row.value}</span>
                                                        {row.url ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAttachmentPreview(row.url, row.label)}
                                                                className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-blue-700">No edited data.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
            <DocumentViewerModal
                isOpen={!!viewingDocument}
                onClose={() => setViewingDocument(null)}
                viewingDocument={viewingDocument}
            />
        </div>
    );
}

// Memoize component to prevent unnecessary re-renders
export default memo(ProfileHeader);
