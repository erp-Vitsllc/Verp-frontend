'use client';

import { useRef, useState, useCallback } from 'react';
import VehiclePlateThumbnail from '@/app/HRM/Asset/Vehicle/components/VehiclePlateThumbnail';
import { Camera } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import ImageUploadModal from './modals/ImageUploadModal';

function formatHdrDate(date) {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '';
    }
}

function truncate(str, max) {
    const s = String(str || '').trim();
    if (!s) return '';
    return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/**
 * Fleet vehicle summary card: photo placeholder, title block, expiry rows, plate graphic, profile completion bar.
 * @param {'none'|'pending_review'|'on_hold'|'active'|'rejected'} [vehicleActPhase] — Fleet profile activation workflow.
 * @param {string} [holdNote] — Asset Controller note when phase is on_hold.
 * @param {boolean} [canRequestActivationAfterHold] — Only the original submitter can re-send after hold.
 * @param {string} [vehicleActivationFlowchartAdminName] — Active flowchart Administrator assignee (company responsibilities).
 */
export default function VehicleAssetProfileHeader({
    asset,
    registrationExpirySrc,
    insuranceExpirySrc,
    warrantyExpirySrc,
    insuranceProviderLabel,
    warrantyKmLabel,
    warrantyRequired = false,
    permitHint,
    onSuccess, // Add onSuccess prop to refresh data
    onActivationRequest,
    vehicleActPhase = 'none',
    holdNote = '',
    vehicleActivationFlowchartAdminName = '',
    canRequestActivationAfterHold = false,
    className = '',
}) {
    const { toast } = useToast();
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageScale, setImageScale] = useState(1);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [showProgressTooltip, setShowProgressTooltip] = useState(false);
    const [isTooltipLocked, setIsTooltipLocked] = useState(false);
    const progressBarRef = useRef(null);
    const tooltipRef = useRef(null);
    const avatarEditorRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast({
                    variant: "destructive",
                    title: "Invalid file",
                    description: "Please select a valid image file"
                });
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setSelectedImage(event.target.result);
                setShowImageModal(true);
                setImageScale(1);
                setError('');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadImage = async () => {
        if (!selectedImage) return;

        try {
            setUploading(true);
            setError('');

            if (!avatarEditorRef.current) {
                throw new Error('Editor not ready');
            }

            const canvas = avatarEditorRef.current.getImageScaledToCanvas();
            const croppedImage = canvas.toDataURL('image/png', 1.0);

            const assetId = asset?._id || asset?.id;
            if (!assetId) throw new Error('Asset ID not found');

            await axiosInstance.put(`/AssetType/${assetId}`, {
                photo: croppedImage,
                imagePreview: croppedImage,
                mode: 'asset'
            });

            toast({
                title: "Photo Updated",
                description: "Vehicle photo has been updated successfully."
            });

            setShowImageModal(false);
            setSelectedImage(null);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Error uploading vehicle image:', err);
            setError(err.response?.data?.message || err.message || 'Failed to upload image');
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: err.response?.data?.message || err.message || 'Failed to upload image'
            });
        } finally {
            setUploading(false);
        }
    };

    const name = truncate(asset?.name || 'Vehicle', 80);
    const subParts = [asset?.typeId?.name || asset?.type, asset?.vehicleCode, asset?.modelYear].filter(
        (x) => x && String(x).trim()
    );
    const subtitle = subParts.join(', ');

    const regExpiry = registrationExpirySrc ? formatHdrDate(registrationExpirySrc) : '';
    const insExpiry = insuranceExpirySrc ? formatHdrDate(insuranceExpirySrc) : '';
    const warExpiry = warrantyExpirySrc ? formatHdrDate(warrantyExpirySrc) : '';
    const purchase = asset?.purchaseDate ? formatHdrDate(asset.purchaseDate) : '';

    const insBy = truncate(insuranceProviderLabel, 56);

    const warrantyLineParts = [];
    if (warExpiry) warrantyLineParts.push(warExpiry);
    const kmRaw = warrantyKmLabel;
    const hasKmValue = !(
        kmRaw === null ||
        kmRaw === undefined ||
        String(kmRaw).trim() === ''
    );
    if (hasKmValue) {
        const kmNum = Number(kmRaw);
        const kmDisplay = Number.isFinite(kmNum) ? `${kmNum.toLocaleString()} KM` : `${String(kmRaw).trim()} KM`;
        warrantyLineParts.push(kmDisplay);
    }

    const mortgageBy = truncate(
        asset?.mortgageBy ||
            asset?.mortgageBank ||
            asset?.bankName ||
            asset?.financedBy ||
            '',
        56,
    );
    const assigneeName = (() => {
        const a = asset?.assignedTo;
        if (a && typeof a === 'object') {
            const n = `${a.firstName || ''} ${a.lastName || ''}`.trim();
            return n || a.employeeId || '';
        }
        return '';
    })();
    const assignedDays = (() => {
        if (!asset?.assignedDate || !assigneeName) return '';
        const t = new Date(asset.assignedDate);
        if (Number.isNaN(t.getTime())) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        t.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
        return String(Math.max(diff, 0));
    })();

    const rows = [
        { label: 'Insurance by', value: insBy || '-' },
        { label: 'Mortgage By', value: mortgageBy || '-' },
        { label: 'Purchase Date', value: purchase || '-' },
        {
            label: 'Warranty',
            value: warrantyRequired
                ? (warrantyLineParts.length ? warrantyLineParts.join(' - ') : 'Pending')
                : 'No'
        },
        {
            label: 'Assignee',
            value: assigneeName ? `${assigneeName} - ${assignedDays || '0'} Days` : 'Unassigned',
        },
    ];

    const photoSrc = asset?.imagePreview || asset?.photo || asset?.images?.[0]?.url || '';

    // Vehicle completion rule: Registration + Insurance + (Warranty only if enabled).
    const completionChecks = [
        { label: 'Registration Card', completed: Boolean(regExpiry) },
        { label: 'Insurance', completed: Boolean(insExpiry) },
        ...(warrantyRequired ? [{ label: 'Warranty Card', completed: Boolean(warExpiry) }] : []),
    ];
    const totalRequiredChecks = completionChecks.length || 1;
    const completedRequiredChecks = completionChecks.filter((c) => c.completed).length;
    const profilePct = Math.round((completedRequiredChecks / totalRequiredChecks) * 100);
    const pendingChecks = completionChecks.filter((c) => !c.completed);

    const initials = name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'V';

    return (
        <div
            className={`w-full rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 overflow-hidden ring-1 ring-slate-950/[0.03] ${className}`}
        >
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
                <div className="shrink-0 mx-auto sm:mx-0 relative group cursor-pointer" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = handleFileSelect;
                    input.click();
                }}>
                    {photoSrc ? (
                        <div className="w-[180px] h-[230px] rounded-sm border border-slate-300 overflow-hidden bg-slate-100">
                            <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-[180px] h-[230px] rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center shadow-lg border border-white/10 relative">
                            <span className="text-[48px] font-black text-white tracking-tighter uppercase leading-none drop-shadow-sm">
                                {initials}
                            </span>
                            
                            {/* Status Dot */}
                            <div className="absolute bottom-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg">
                                <div className="w-5 h-5 bg-[#00D26A] rounded-full border-2 border-white"></div>
                            </div>
                        </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-sm overflow-hidden">
                        <div className="w-12 h-12 bg-white/90 backdrop-blur-sm text-[#1E6BFA] rounded-2xl flex items-center justify-center shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-[#1E6BFA] hover:text-white border border-white/20">
                            <Camera size={24} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col pt-0">
                    <div className="flex items-start justify-between gap-6 mb-2">
                        <div className="min-w-0 flex flex-col gap-1.5">
                            <h2 className="text-[20px] font-black text-black tracking-tighter leading-none uppercase">{name}</h2>
                            {subtitle ? <p className="text-[14px] font-bold text-black leading-none uppercase">{subtitle}</p> : null}
                        </div>
                        
                        <div className="shrink-0 pt-1">
                            {asset?.plateNumber?.trim() ? (
                                <VehiclePlateThumbnail plateEmirate={asset.plateEmirate} plateNumber={asset.plateNumber} />
                            ) : (
                                <div className="h-[44px] w-[132px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center">
                                    Plate not set
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-0">
                        {rows.map((row) => (
                            <div key={row.label} className="flex items-baseline gap-2">
                                <span className="text-[14px] font-black text-black uppercase whitespace-nowrap">{row.label} :</span>
                                <span className="text-[14px] font-bold text-black leading-tight">{row.value}</span>
                            </div>
                        ))}
                        {vehicleActPhase === 'active' ? (
                            <div className="pt-1">
                                <span
                                    className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/90"
                                    title="Fleet profile activation is complete for this vehicle"
                                >
                                    Profile activated
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 pb-6 mt-4">
                <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-slate-600 mb-2.5">
                    <span>Profile Status</span>
                    <span>{profilePct}%</span>
                </div>
                <div
                    ref={progressBarRef}
                    className="relative w-full"
                    onMouseEnter={() => setShowProgressTooltip(true)}
                    onMouseLeave={() => {
                        if (!isTooltipLocked) setShowProgressTooltip(false);
                    }}
                    onClick={() => {
                        setIsTooltipLocked((prev) => !prev);
                        setShowProgressTooltip(true);
                    }}
                >
                    <div className="h-[8px] w-full bg-slate-100 rounded-full overflow-hidden cursor-pointer">
                        <div
                            className="h-full bg-[#1E6BFA] rounded-full transition-all duration-500"
                            style={{ width: `${profilePct}%` }}
                        />
                    </div>
                    {showProgressTooltip && pendingChecks.length > 0 && (
                        <div
                            ref={tooltipRef}
                            className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 text-gray-700 text-xs rounded-lg shadow-lg border border-gray-200 p-3 z-50 backdrop-blur-sm cursor-default"
                            onMouseEnter={() => setShowProgressTooltip(true)}
                            onMouseLeave={() => {
                                if (!isTooltipLocked) setShowProgressTooltip(false);
                            }}
                            onClick={(e) => e.stopPropagation()}
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
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                                        {pendingChecks.length} Pending
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 mb-1">
                                {pendingChecks.map((item) => (
                                    <div key={item.label} className="flex flex-col">
                                        <span className="font-medium text-gray-600 text-[11px] uppercase tracking-wide">Required:</span>
                                        <span className="text-gray-500 pl-1 border-l-2 border-gray-200">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="absolute bottom-0 left-4 transform translate-y-full">
                                <div className="border-4 border-transparent border-t-white/95"></div>
                            </div>
                        </div>
                    )}
                </div>
                {profilePct === 100 &&
                    (vehicleActPhase === 'none' ||
                        vehicleActPhase === 'rejected' ||
                        (vehicleActPhase === 'on_hold' && canRequestActivationAfterHold)) && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof onActivationRequest === 'function') {
                                    onActivationRequest();
                                } else {
                                    toast({
                                        title: 'Profile complete',
                                        description:
                                            'Registration and insurance are on file. Connect Request activation in the parent page to open the submit modal.',
                                    });
                                }
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
                        >
                            {vehicleActPhase === 'on_hold' ? 'Resubmit for review' : 'Request activation'}
                        </button>
                    </div>
                )}
                {profilePct === 100 && vehicleActPhase === 'pending_review' && (
                    <p className="mt-3 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        {String(vehicleActivationFlowchartAdminName || '').trim() ? (
                            <>
                                Waiting for <strong>{String(vehicleActivationFlowchartAdminName).trim()}</strong>{' '}
                                (flowchart Administrator) — only they can clear the dashboard task.
                            </>
                        ) : (
                            <>
                                Waiting for the flowchart <strong>Administrator</strong> — only they can clear the
                                dashboard task.
                            </>
                        )}
                    </p>
                )}
                {profilePct === 100 && vehicleActPhase === 'on_hold' && (
                    <div className="mt-3 space-y-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <p>
                            The flowchart <strong>Administrator</strong> placed this request <strong>on hold</strong>.
                            Update the listed areas, then resubmit. Sections that were not approved are not removed from
                            the vehicle record.
                        </p>
                        {holdNote ? (
                            <p className="text-amber-950 font-bold border-t border-amber-100 pt-2 mt-2">
                                Note: {holdNote}
                            </p>
                        ) : null}
                        {!canRequestActivationAfterHold ? (
                            <p className="text-amber-800 font-medium">
                                Only the colleague who submitted this request can resubmit after a hold.
                            </p>
                        ) : null}
                    </div>
                )}
                {profilePct === 100 && vehicleActPhase === 'rejected' && (
                    <p className="mt-3 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                        The last activation request was <strong>rejected</strong>. Update details if needed, then request
                        activation again.
                    </p>
                )}
            </div>

            <ImageUploadModal
                isOpen={showImageModal}
                onClose={() => {
                    if (!uploading) {
                        setShowImageModal(false);
                        setSelectedImage(null);
                        setImageScale(1);
                        setError('');
                    }
                }}
                selectedImage={selectedImage}
                imageScale={imageScale}
                setImageScale={setImageScale}
                uploading={uploading}
                error={error}
                avatarEditorRef={avatarEditorRef}
                onFileSelect={handleFileSelect}
                onUpload={handleUploadImage}
                borderRadius={4}
            />
        </div>
    );
}
