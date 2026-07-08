'use client';

import { useRef } from 'react';
import { ImageIcon, Loader2, Plus, Upload } from 'lucide-react';
import { HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS } from '../utils/vehicleHandoverReceiverAssessment';

export default function VehicleHandoverBodyConditionPhotoCell({
    label,
    photoUrl,
    readOnly = false,
    uploading = false,
    missing = false,
    onPreview,
    onOpenPicker,
}) {
    const boxClass = `${HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS} border bg-gray-100 ${
        missing ? 'border-amber-300' : 'border-gray-200'
    }`;

    if (readOnly) {
        if (!photoUrl) {
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
                    className="absolute inset-0 block overflow-hidden text-left disabled:cursor-default"
                >
                    <img
                        src={photoUrl}
                        alt={`${label} photo`}
                        className="h-full w-full object-cover object-center"
                    />
                </button>
            </div>
        );
    }

    return (
        <div className={`relative ${boxClass}`}>
            {photoUrl ? (
                <button
                    type="button"
                    onClick={onPreview}
                    className="absolute inset-0 block overflow-hidden text-left transition-colors hover:ring-2 hover:ring-slate-300"
                >
                    <img
                        src={photoUrl}
                        alt={`${label} photo`}
                        className="h-full w-full object-cover object-center"
                    />
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
                {photoUrl ? (
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
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onChooseNew?.(file);
                    event.target.value = '';
                }}
            />
        </>
    );
}
