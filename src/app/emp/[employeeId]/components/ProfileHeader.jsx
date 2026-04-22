'use client';

import { memo, useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { getInitials } from '../utils/helpers';
import { useToast } from '@/hooks/use-toast';
import { Camera, FileText } from 'lucide-react';

function ProfileHeader({
    employee,
    imageError,
    setImageError,
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
    handleRejectProfile,
    activatingProfile,
    profileApproved,
    isPrimaryReportee,
    canReviewNoticeRequest = false,
    canReviewProfileActivation = false,
    onViewRequestedChange,
    onReviewNotice,
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
    hideEmployeeStatus = false
}) {
    const { toast } = useToast();
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showActivationModal, setShowActivationModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [selectedChangeIds, setSelectedChangeIds] = useState([]);
    const [viewingChange, setViewingChange] = useState(null);
    const [viewingAttachment, setViewingAttachment] = useState(null);
    const toSerializable = (value) => {
        if (value == null) return null;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return value;
        }
    };
    const isEffectivelyEmptyObject = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        return Object.keys(value).length === 0;
    };
    const resolveReviewData = (entry, kind = 'proposed') => {
        if (!entry || typeof entry !== 'object') return {};
        const candidates = kind === 'previous'
            ? [entry.previousData, entry.previous, entry.oldData, entry.fromData]
            : [entry.proposedData, entry.proposed, entry.newData, entry.toData, entry.payload];
        for (const candidate of candidates) {
            const serial = toSerializable(candidate);
            if (serial == null) continue;
            if (typeof serial === 'object') {
                if (!isEffectivelyEmptyObject(serial) || Array.isArray(serial)) return serial;
            } else {
                return serial;
            }
        }
        if (kind === 'proposed') {
            const fallback = {};
            Object.entries(entry).forEach(([key, value]) => {
                if ([
                    '_id',
                    'card',
                    'reason',
                    'section',
                    'changeType',
                    'targetIndex',
                    'changedAt',
                    'previousData',
                    'proposedData',
                    'previous',
                    'proposed',
                    'oldData',
                    'newData',
                    'fromData',
                    'toData',
                    '__v',
                ].includes(key)) return;
                fallback[key] = value;
            });
            const serialFallback = toSerializable(fallback);
            if (serialFallback && Object.keys(serialFallback).length > 0) return serialFallback;
        }
        return {};
    };
    const toLabel = (key = '') => {
        return String(key)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (m) => m.toUpperCase());
    };
    const toDisplayValue = (value) => {
        if (value == null || value === '') return '-';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            if (/^\d{4}-\d{2}-\d{2}t/i.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                const d = new Date(value);
                if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
            }
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return value.length > 90 ? `${value.slice(0, 90)}...` : value;
            }
            return value;
        }
        return JSON.stringify(value);
    };
    const getFileNameFromRef = (value) => {
        if (!value) return '-';
        if (typeof value === 'string') {
            const clean = value.split('?')[0];
            const last = clean.split('/').filter(Boolean).pop();
            return last || clean;
        }
        if (typeof value === 'object') {
            if (value.name) return value.name;
            if (value.url) return getFileNameFromRef(value.url);
        }
        return '-';
    };
    const buildCardRowsForView = (data) => {
        if (!data || typeof data !== 'object') return [];
        const rows = [];
        const pushIfPresent = (label, value) => {
            if (value === undefined || value === null || value === '') return;
            rows.push({ label, value: toDisplayValue(value) });
        };

        // Common card-style fields
        pushIfPresent('Number', data.number);
        pushIfPresent('Provider', data.provider);
        pushIfPresent('Nationality', data.nationality);
        pushIfPresent('Sponsor', data.sponsor);
        pushIfPresent('Issue Date', data.issueDate);
        pushIfPresent('Expiry Date', data.expiryDate);
        pushIfPresent('Place Of Issue', data.placeOfIssue);
        pushIfPresent('Designation', data.designation);
        pushIfPresent('Department', data.department);
        pushIfPresent('Company Email', data.companyEmail);
        pushIfPresent('Status', data.status);
        pushIfPresent('Probation Period', data.probationPeriod);

        // Attachments shown as file names (not raw URL/publicId)
        if (data.document) {
            const documentUrl = typeof data.document === 'object' ? data.document.url : (typeof data.document === 'string' ? data.document : '');
            rows.push({ label: 'Document', value: getFileNameFromRef(data.document), url: documentUrl || '' });
        }
        if (data.labourContractAttachment) {
            const contractUrl = typeof data.labourContractAttachment === 'object'
                ? data.labourContractAttachment.url
                : (typeof data.labourContractAttachment === 'string' ? data.labourContractAttachment : '');
            rows.push({
                label: 'Labour Contract Attachment',
                value: getFileNameFromRef(data.labourContractAttachment),
                url: contractUrl || '',
            });
        }
        if (data.passportCopy) {
            const passportUrl = typeof data.passportCopy === 'object' ? data.passportCopy.url : (typeof data.passportCopy === 'string' ? data.passportCopy : '');
            rows.push({ label: 'Passport Copy', value: getFileNameFromRef(data.passportCopy), url: passportUrl || '' });
        }
        if (data.visaCopy) {
            const visaUrl = typeof data.visaCopy === 'object' ? data.visaCopy.url : (typeof data.visaCopy === 'string' ? data.visaCopy : '');
            rows.push({ label: 'Visa Copy', value: getFileNameFromRef(data.visaCopy), url: visaUrl || '' });
        }

        // Fallback for unknown cards
        if (rows.length === 0) {
            Object.entries(data).forEach(([key, value]) => {
                if (['_id', '__v', 'publicId', 'mimeType', 'lastUpdated', 'passportExp'].includes(key)) return;
                if (value && typeof value === 'object') {
                    if (key.toLowerCase().includes('document') || key.toLowerCase().includes('attachment')) {
                        const fallbackUrl = typeof value === 'object' ? (value.url || '') : (typeof value === 'string' ? value : '');
                        rows.push({ label: toLabel(key), value: getFileNameFromRef(value), url: fallbackUrl || '' });
                    }
                    return;
                }
                if (value === undefined || value === null || value === '') return;
                rows.push({ label: toLabel(key), value: toDisplayValue(value) });
            });
        }
        return rows;
    };
    const pendingReactivationEntries = useMemo(() => {
        const list = Array.isArray(employee?.pendingReactivationChanges) ? employee.pendingReactivationChanges : [];
        return list.map((entry, idx) => ({
            ...entry,
            _id: String(entry?._id || idx),
            card: String(entry?.card || '').trim() || 'Profile change',
            changeType: String(entry?.changeType || '').trim(),
            section: String(entry?.section || '').trim(),
        }));
    }, [employee?.pendingReactivationChanges]);
    const allSelected = pendingReactivationEntries.length > 0 && selectedChangeIds.length === pendingReactivationEntries.length;

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

    const handleReject = async () => {
        if (!rejectionReason || rejectionReason.trim().length === 0) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for rejection.",
                variant: "destructive"
            });
            return;
        }
        await handleRejectProfile(rejectionReason);
        setShowActivationModal(false);
        setRejectionReason('');
    };
    const openActivationReview = () => {
        setSelectedChangeIds(pendingReactivationEntries.map((entry) => entry._id));
        setShowActivationModal(true);
    };
    const toggleChangeSelection = (id) => {
        setSelectedChangeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedChangeIds([]);
            return;
        }
        setSelectedChangeIds(pendingReactivationEntries.map((entry) => entry._id));
    };
    const [isOnDuty, setIsOnDuty] = useState(true); // Static UI state for "On Duty" / "Leave" toggle
    // ... existing code ...

    const [isTooltipLocked, setIsTooltipLocked] = useState(false);
    const tooltipRef = useRef(null);
    const progressBarRef = useRef(null);

    // Calculate remaining probation duration
    const remainingProbation = useMemo(() => {
        // Prefer contractJoiningDate for probation as per user requirement
        const startRef = employee.contractJoiningDate || employee.dateOfJoining;
        if (!employee.probationPeriod || !startRef) return null;

        const startDate = new Date(startRef);
        const probationMonths = employee.probationPeriod;

        // Calculate probation end date
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + probationMonths);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        if (today >= endDate) return { months: 0, days: 0, expired: true };

        // Calculate precise months and days remaining
        let years = endDate.getFullYear() - today.getFullYear();
        let months = endDate.getMonth() - today.getMonth();
        let days = endDate.getDate() - today.getDate();

        if (days < 0) {
            // Get last day of previous month from target end date month
            const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
            days += prevMonth.getDate();
            months--;
        }

        if (months < 0) {
            months += 12;
            years--;
        }

        const totalMonths = years * 12 + months;

        return { months: totalMonths, days, expired: false };
    }, [employee.probationPeriod, employee.dateOfJoining, employee.contractJoiningDate]);

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

    return (
        <div className={`lg:col-span-1 bg-white rounded-xl shadow-sm ${enlargeProfilePic ? 'p-0 flex flex-row' : 'p-6 flex flex-col'} relative h-full overflow-y-auto`}>

            {/* Main Content Container: Flex row if enlarge, else standard block inside flex-col */}
            <div className={`flex ${enlargeProfilePic ? 'flex-row items-stretch w-full' : 'items-start gap-6'}`}>

                {/* Profile Picture Section */}
                <div className={`flex flex-col items-center gap-3 flex-shrink-0 ${enlargeProfilePic ? 'w-1/4 bg-gray-50 border-r border-gray-100' : ''}`}>
                    {/* ... existing profile pic code ... */}
                    <div className="relative group w-full h-full">
                        <div className={`${enlargeProfilePic ? 'w-full h-full rounded-none border-none' : 'w-40 h-45 rounded-2xl border-4 border-white shadow-xl'} overflow-hidden bg-slate-100 relative group/pic transition-all duration-500`}>
                            {(() => {
                                const rawUrl = employee.profilePicture || employee.profilePic || employee.avatar;
                                const safeUrl = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl;

                                return (safeUrl && !imageError) ? (
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
                        <div className="bg-gray-100 p-1 rounded-lg flex items-center w-32">
                            <button
                                onClick={() => setIsOnDuty(true)}
                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all text-center ${isOnDuty ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                On Duty
                            </button>
                            <button
                                onClick={() => setIsOnDuty(false)}
                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all text-center ${!isOnDuty ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
                            {employee.status && !hideEmployeeStatus && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${employee.status === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                    employee.status === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                        employee.status === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                            employee.status === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                employee.profileApprovalStatus === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                    'bg-gray-100 text-gray-700'
                                    }`}>
                                    {employee.profileApprovalStatus === 'rejected' ? 'Activation Rejected' :
                                        (employee.status === 'Notice' ? (employee.noticeRequest?.reason || 'Notice') : employee.status)}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className={`flex-1 ${enlargeProfilePic ? 'p-6 flex flex-col justify-center' : ''}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex flex-col gap-2">
                            {!showNameUnderProfilePic && (
                                <>
                                    <h1 className="text-2xl font-black text-gray-800">
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
                                    {employee.status && !hideEmployeeStatus && (
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${employee.status === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                                employee.status === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                                    employee.status === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                                        employee.status === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                            employee.profileApprovalStatus === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                'bg-gray-100 text-gray-700'
                                                }`}>
                                                {employee.profileApprovalStatus === 'rejected' ? 'Activation Rejected' :
                                                    (employee.status === 'Notice' ? (employee.noticeRequest?.reason || 'Notice') : employee.status)}
                                            </span>
                                            {employee.status === 'Notice' && employee.noticeRequest?.duration && (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                                    {employee.noticeRequest.duration}
                                                </span>
                                            )}
                                            {employee.status === 'Probation' && employee.probationPeriod && remainingProbation && !remainingProbation.expired && (
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
                        {/* Approval Button near Status */}
                        <div className="flex items-center gap-2">
                            {/* Notice Review Button - Replaces Activation buttons for Primary Reportee if pending */}
                            {employee?.noticeRequest?.status === 'Pending' && (canReviewNoticeRequest || isPrimaryReportee) ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onReviewNotice) onReviewNotice();
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-orange-100 text-orange-600 hover:bg-orange-200 flex items-center gap-2"
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                    {employee?.noticeRequest?.reason === 'Termination' ? 'Review Termination Request' : 'Review Resignation Request'}
                                </button>
                            ) : (
                                <>
                                    {canSendForApproval && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSubmitForApproval();
                                            }}
                                            disabled={sendingApproval}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                                        >
                                            {sendingApproval ? 'Sending...' : (employee.profileApprovalStatus === 'rejected' ? 'Resubmit for Activation' : 'Send for Activation')}
                                        </button>
                                    )}
                                    {awaitingApproval && (
                                        <button
                                            onClick={(e) => {
                                                if (canReviewProfileActivation) {
                                                    e.stopPropagation();
                                                    openActivationReview();
                                                }
                                            }}
                                            disabled={activatingProfile || !canReviewProfileActivation}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap ${canReviewProfileActivation
                                                ? "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                                                : "bg-gray-100 text-gray-400 border border-gray-200"
                                                } disabled:cursor-not-allowed`}
                                        >
                                            {activatingProfile ? 'Processing...' : (canReviewProfileActivation ? 'Review Activation' : 'Waiting for HR')}
                                        </button>
                                    )}
                                    {pendingReactivationEntries.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openActivationReview();
                                            }}
                                            className="h-10 w-10 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center"
                                            title="View requested edited cards"
                                        >
                                            <FileText size={16} />
                                        </button>
                                    )}
                                    {profileApproved && (
                                        <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
                                            Profile activated
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    {!hideRole && (
                        <p className="text-gray-600 mb-3">{employee.role || employee.designation || 'Employee'}</p>
                    )}

                    {extraContent}



                    {/* Contact Info */}
                    {(employee.contactNumber || employee.companyEmail || employee.workEmail) && (
                        <div className="space-y-2 mb-4">
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
                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
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
                <div className="mt-6 flex-1 flex flex-col">
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
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
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
            {/* Profile Activation Modal */}
            {showActivationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 pb-2">
                            <h3 className="text-xl font-bold text-gray-800">Profile Activation</h3>
                            <p className="text-sm text-gray-500 mt-1">Review and action the activation request for {employee.firstName}.</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Submitted Request Details</div>
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-gray-700">Reason</div>
                                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                                        {activationRequestDetails.reason || '---'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-gray-700">Description</div>
                                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                                        {activationRequestDetails.description || '---'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-gray-700">Attachment</div>
                                    {activationRequestDetails.attachment ? (
                                        <button
                                            type="button"
                                            onClick={() => setViewingAttachment({ url: activationRequestDetails.attachment, label: activationRequestDetails.attachmentName || 'Attachment' })}
                                            className="text-sm font-semibold text-blue-700 hover:underline break-all text-left"
                                        >
                                            {activationRequestDetails.attachmentName || 'View attachment'}
                                        </button>
                                    ) : (
                                        <div className="text-sm text-gray-500">No attachment provided.</div>
                                    )}
                                </div>
                                {pendingReactivationEntries.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-gray-700">Requested Changes</div>
                                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={toggleSelectAll}
                                                />
                                                Select all
                                            </label>
                                        </div>
                                        <div className="space-y-2">
                                            {pendingReactivationEntries.map((entry) => (
                                                <div key={entry._id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 gap-2">
                                                    <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedChangeIds.includes(entry._id)}
                                                            onChange={() => toggleChangeSelection(entry._id)}
                                                        />
                                                        <span className="text-sm text-gray-800 truncate">
                                                            {entry.card}
                                                            {entry.changeType ? ` (${entry.changeType})` : ''}
                                                        </span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onViewRequestedChange?.(entry.card);
                                                            setViewingChange(entry);
                                                        }}
                                                        className="text-xs font-semibold text-blue-700 hover:underline"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Rejection Reason <span className="text-red-500">*</span></label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all text-sm min-h-[100px]"
                                    placeholder="Please provide a reason for rejection..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-gray-400 font-medium">This reason is mandatory and will be visible in the profile history.</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-between gap-3">
                            <button
                                onClick={() => {
                                    setShowActivationModal(false);
                                    setRejectionReason('');
                                }}
                                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReject}
                                    disabled={activatingProfile}
                                    className="px-6 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold text-sm transition-colors border border-red-200 disabled:opacity-50"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={async () => {
                                        await handleActivateProfile(selectedChangeIds);
                                        setShowActivationModal(false);
                                    }}
                                    disabled={activatingProfile}
                                    className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold text-sm transition-colors shadow-md shadow-blue-200 disabled:opacity-50"
                                >
                                    Activate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {viewingChange && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
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
                                    {buildCardRowsForView(resolveReviewData(viewingChange, 'previous')).length > 0 ? (
                                        buildCardRowsForView(resolveReviewData(viewingChange, 'previous')).map((row, idx) => (
                                            <div key={`old-${idx}`} className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-gray-200 last:border-b-0">
                                                <div className="col-span-4 text-sm font-semibold text-gray-700">{row.label}</div>
                                                <div className="col-span-8 text-sm text-gray-800 break-all flex items-center justify-between gap-3">
                                                    <span>{row.value}</span>
                                                    {row.url ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingAttachment({ url: row.url, label: row.label })}
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
                                    {buildCardRowsForView(resolveReviewData(viewingChange, 'proposed')).length > 0 ? (
                                        buildCardRowsForView(resolveReviewData(viewingChange, 'proposed')).map((row, idx) => (
                                            <div key={`new-${idx}`} className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-blue-100 last:border-b-0">
                                                <div className="col-span-4 text-sm font-semibold text-blue-800">{row.label}</div>
                                                <div className="col-span-8 text-sm text-blue-900 break-all flex items-center justify-between gap-3">
                                                    <span>{row.value}</span>
                                                    {row.url ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingAttachment({ url: row.url, label: row.label })}
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
            )}
            {viewingAttachment && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">{viewingAttachment.label || 'Attachment'}</h3>
                            <button
                                type="button"
                                onClick={() => setViewingAttachment(null)}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-50">
                            <iframe
                                src={viewingAttachment.url}
                                title={viewingAttachment.label || 'Attachment preview'}
                                className="w-full h-full border-0"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Memoize component to prevent unnecessary re-renders
export default memo(ProfileHeader);
