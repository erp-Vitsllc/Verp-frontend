'use client';

import { Plus } from 'lucide-react';
import {
    SERVICE_BODY_PART_OPTIONS,
    SERVICE_NEW_CONDITION_PHOTO_SLOTS,
    labelForServiceBodyPartKey,
    usedServiceBodyPartKeys,
} from '../utils/vehicleServiceNewConditionPhotos';

function directConditionImageSrc(img) {
    const url = String(img?.url || img?.data || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    return '';
}

/**
 * New Condition Photos strip with per-photo "Replace to" handover body-part select.
 * Each body part can be chosen only once across new uploads.
 */
export default function VehicleServiceNewConditionPhotoStrip({
    existingImages = [],
    newImages = [],
    resolvedExistingSrc = {},
    disabled = false,
    photoAddBtnClass = '',
    photoThumbClass = '',
    fieldSelectClass = '',
    onAdd,
    onPreview,
    onBodyPartChange,
}) {
    const cells = [];

    if (!disabled && typeof onAdd === 'function') {
        cells.push(
            <button key="add" type="button" onClick={onAdd} className={photoAddBtnClass} aria-label="Add photo">
                <Plus size={20} />
            </button>,
        );
    }

    (existingImages || []).forEach((img, idx) => {
        const src = resolvedExistingSrc[`existing-${idx}`] || directConditionImageSrc(img);
        if (!src) return;
        const partLabel = labelForServiceBodyPartKey(img?.bodyPartKey);
        cells.push(
            <div key={`ex-${idx}`} className="flex w-[72px] flex-col gap-1">
                <button type="button" onClick={() => onPreview?.(src)} className={photoThumbClass}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
                {partLabel ? (
                    <span className="truncate text-center text-[8px] font-semibold leading-tight text-orange-700">
                        {partLabel}
                    </span>
                ) : null}
            </div>,
        );
    });

    (newImages || []).forEach((img, idx) => {
        const mime = img?.mimeType || 'image/jpeg';
        const src = img?.data ? `data:${mime};base64,${img.data}` : '';
        if (!src) return;
        const used = usedServiceBodyPartKeys(newImages, idx);
        const selected = String(img?.bodyPartKey || '').trim();

        cells.push(
            <div key={`nw-${idx}`} className="flex w-[120px] flex-col gap-1">
                <button type="button" onClick={() => onPreview?.(src)} className={photoThumbClass}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
                {!disabled ? (
                    <select
                        className={`${fieldSelectClass} min-h-[28px] px-1 py-0.5 text-[10px]`.trim()}
                        value={selected}
                        onChange={(e) => onBodyPartChange?.(idx, e.target.value)}
                        aria-label={`Replace to body part for photo ${idx + 1}`}
                    >
                        <option value="">Replace to…</option>
                        {SERVICE_BODY_PART_OPTIONS.map((opt) => (
                            <option
                                key={opt.key}
                                value={opt.key}
                                disabled={used.has(opt.key) && opt.key !== selected}
                            >
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : selected ? (
                    <span className="truncate text-center text-[8px] font-semibold leading-tight text-orange-700">
                        {labelForServiceBodyPartKey(selected)}
                    </span>
                ) : null}
            </div>,
        );
    });

    while (cells.length < SERVICE_NEW_CONDITION_PHOTO_SLOTS) {
        cells.push(
            <div
                key={`empty-${cells.length}`}
                className={`${photoThumbClass} border-dashed bg-gray-50`}
            />,
        );
    }

    return <div className="flex flex-wrap items-start gap-2">{cells.slice(0, SERVICE_NEW_CONDITION_PHOTO_SLOTS)}</div>;
}
