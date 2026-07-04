'use client';

import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS } from '../utils/vehicleHandoverReceiverAssessment';

/**
 * Fixed landscape photo slot — card size never changes; image fills the box.
 */
export default function VehicleHandoverLandscapePhotoBox({
    label,
    photoUrl,
    missing = false,
    uploading = false,
    readOnly = false,
    onUpload,
    onPreview,
    inputIdPrefix = 'handover-photo',
    uploadLabel = 'Upload photo',
    changeLabel = 'Change',
    boxClassName = HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS,
}) {
    const inputId = `${inputIdPrefix}-${String(label || 'photo').replace(/\s+/g, '-')}`;
    const boxClass = `${boxClassName} border bg-gray-100 ${
        missing ? 'border-amber-300' : 'border-gray-200'
    }`;

    if (photoUrl) {
        return (
            <div className={`relative ${boxClass}`}>
                <button
                    type="button"
                    onClick={onPreview}
                    disabled={!onPreview}
                    className="absolute inset-0 block overflow-hidden text-left transition-colors hover:ring-2 hover:ring-slate-300 disabled:cursor-default disabled:hover:ring-0"
                >
                    <img
                        src={photoUrl}
                        alt={`${label} photo`}
                        className="h-full w-full object-cover object-center"
                    />
                </button>
                {!readOnly ? (
                    <label
                        htmlFor={`${inputId}-replace`}
                        className="absolute bottom-1.5 right-1.5 z-10 inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-white"
                    >
                        <Upload size={10} />
                        {changeLabel}
                        <input
                            id={`${inputId}-replace`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onUpload?.(file);
                                event.target.value = '';
                            }}
                        />
                    </label>
                ) : null}
            </div>
        );
    }

    if (readOnly) {
        return (
            <div className={`flex items-center justify-center ${boxClass} border-gray-100 bg-gray-50`}>
                <ImageIcon size={20} className="text-gray-300" strokeWidth={1.5} />
            </div>
        );
    }

    return (
        <label
            htmlFor={inputId}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 border-dashed bg-gray-50 transition-colors hover:bg-gray-100 ${boxClass} ${
                missing ? 'border-amber-300 text-amber-600' : 'text-gray-400'
            }`}
        >
            {uploading ? (
                <Loader2 size={20} className="animate-spin" />
            ) : (
                <>
                    <ImageIcon size={20} strokeWidth={1.5} />
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600">
                        <Upload size={12} />
                        {uploadLabel}
                    </span>
                </>
            )}
            <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload?.(file);
                    event.target.value = '';
                }}
            />
        </label>
    );
}

export function VehicleHandoverLandscapePhotoPlaceholder({
    children,
    boxClassName = HANDOVER_LANDSCAPE_PHOTO_BOX_CLASS,
}) {
    return (
        <div
            className={`flex items-center justify-center border border-gray-100 bg-gray-50 px-2 text-center text-[11px] text-gray-400 ${boxClassName}`}
        >
            {children}
        </div>
    );
}
