'use client';

import { useRef } from 'react';
import { ImageIcon, Loader2, Plus, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ERP_JPEG_ACCEPT, validateErpJpegFile } from '@/utils/uploadFileTypes';
import { HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS, hasAssessmentPhoto } from '../utils/vehicleHandoverReceiverAssessment';
import useAssessmentMediaUrl from '../hooks/useAssessmentMediaUrl';

export default function VehicleHandoverBodyConditionPhotoCell({
    label,
    photo = null,
    photoUrl: photoUrlProp = null,
    readOnly = false,
    uploading = false,
    missing = false,
    onPreview,
    onOpenPicker,
}) {
    const resolved = useAssessmentMediaUrl(photo || photoUrlProp);
    const photoUrl = resolved.url || (typeof photoUrlProp === 'string' && photoUrlProp.startsWith('data:') ? photoUrlProp : null);
    const hasPhoto = hasAssessmentPhoto(photo) || Boolean(photoUrl);
    const boxClass = `${HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS} border bg-gray-100 ${
        missing ? 'border-amber-300' : 'border-gray-200'
    }`;

    if (readOnly) {
        if (!hasPhoto) {
            return (
                <div className={`flex items-center justify-center ${boxClass} border-gray-100 bg-gray-50`}>
                    <ImageIcon size={20} className="text-gray-300" strokeWidth={1.5} />
                </div>
            );
        }

        return (
            <div className={`relative ${boxClass}`}>
                <button
                    type="button"
                    onClick={onPreview}
                    disabled={!onPreview}
                    className="absolute inset-0 flex items-center justify-center overflow-hidden text-left disabled:cursor-default"
                >
                    {resolved.loading && !photoUrl ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : photoUrl ? (
                        <img
                            src={photoUrl}
                            alt={`${label} photo`}
                            className="h-full w-full object-cover object-center"
                            loading="lazy"
                            decoding="async"
                            onError={resolved.retry}
                        />
                    ) : (
                        <ImageIcon size={20} className="text-gray-300" strokeWidth={1.5} />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className={`relative ${boxClass}`}>
            {hasPhoto ? (
                <button
                    type="button"
                    onClick={onPreview}
                    className="absolute inset-0 flex items-center justify-center overflow-hidden text-left transition-colors hover:ring-2 hover:ring-slate-300"
                >
                    {resolved.loading && !photoUrl ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : photoUrl ? (
                        <img
                            src={photoUrl}
                            alt={`${label} photo`}
                            className="h-full w-full object-cover object-center"
                            loading="lazy"
                            decoding="async"
                            onError={resolved.retry}
                        />
                    ) : uploading ? (
                        <Loader2 size={20} className="animate-spin text-slate-400" />
                    ) : (
                        <ImageIcon size={20} className="text-gray-300" strokeWidth={1.5} />
                    )}
                </button>
            ) : (
                <div
                    className={`flex h-full w-full flex-col items-center justify-center gap-1.5 border-dashed bg-gray-50 text-gray-400 ${
                        missing ? 'border-amber-300 text-amber-600' : ''
                    }`}
                >
                    {uploading ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <>
                            <ImageIcon size={20} strokeWidth={1.5} />
                            <span className="text-[10px] font-semibold text-gray-500">No photo yet</span>
                        </>
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={onOpenPicker}
                disabled={uploading}
                className="absolute bottom-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-white disabled:opacity-50"
            >
                {hasPhoto ? (
                    <>
                        <Upload size={10} />
                        Change
                    </>
                ) : (
                    <>
                        <Plus size={10} />
                        Add
                    </>
                )}
            </button>
        </div>
    );
}

export function BodyConditionPhotoPickerOverlay({
    hasPreviousPhoto,
    showNewImageFineHint = false,
    previousPhotoLoading = false,
    previousPhotoUnavailable = false,
    onChoosePrevious,
    onChooseNew,
    onCancel,
}) {
    const fileInputRef = useRef(null);
    const { toast } = useToast();

    const previousLabel = previousPhotoLoading
        ? 'Loading previous…'
        : previousPhotoUnavailable
          ? 'Previous unavailable'
          : 'Previous image';

    return (
        <>
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/85 p-4 backdrop-blur-sm">
                <p className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    Choose photo source
                </p>
                <button
                    type="button"
                    onClick={onChoosePrevious}
                    disabled={!hasPreviousPhoto || previousPhotoLoading}
                    className="w-full max-w-[220px] rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {previousPhotoLoading ? (
                        <span className="inline-flex items-center justify-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" />
                            {previousLabel}
                        </span>
                    ) : (
                        previousLabel
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full max-w-[220px] rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-red-800 transition-colors hover:bg-red-100"
                >
                    New image
                </button>
                {showNewImageFineHint ? (
                    <p className="max-w-[220px] text-center text-[9px] font-medium leading-snug text-red-600">
                        A new image may result in a fine for you.
                    </p>
                ) : null}
                <button
                    type="button"
                    onClick={onCancel}
                    className="mt-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                >
                    Cancel
                </button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept={ERP_JPEG_ACCEPT}
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                        const check = validateErpJpegFile(file);
                        if (!check.ok) {
                            toast({
                                variant: 'destructive',
                                title: 'Invalid file',
                                description: check.message,
                            });
                            event.target.value = '';
                            return;
                        }
                        onChooseNew?.(file);
                    }
                    event.target.value = '';
                }}
            />
        </>
    );
}
