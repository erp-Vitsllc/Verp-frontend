'use client';

import { useMemo, useRef, useState } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ERP_JPEG_ACCEPT, validateErpJpegFile } from '@/utils/uploadFileTypes';
import useAssessmentMediaUrl from '../hooks/useAssessmentMediaUrl';
import {
    SERVICE_BODY_PART_OPTIONS,
    labelForServiceBodyPartKey,
    usedServiceBodyPartKeys,
} from '../utils/vehicleServiceNewConditionPhotos';
import { tireFieldSelect, tireUploadBtn } from '../utils/vehicleAccidentRepairDetailUi';

function directDataUrl(img) {
    if (!img?.data) return '';
    const mime = img.mimeType || 'image/jpeg';
    return `data:${mime};base64,${img.data}`;
}

function AddedPhotoThumb({ label, src, onPreview, onRemove, disabled }) {
    const isDirectUrl =
        typeof src === 'string' &&
        (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http'));
    const resolved = useAssessmentMediaUrl(isDirectUrl ? null : src || null);
    const displaySrc = isDirectUrl ? src : resolved.url || '';

    return (
        <div className="relative w-[112px] shrink-0">
            <button
                type="button"
                onClick={() => displaySrc && onPreview?.(displaySrc)}
                className="h-[96px] w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50"
            >
                {displaySrc ? (
                    <img src={displaySrc} alt={label} className="h-full w-full object-cover" />
                ) : (
                    <span className="flex h-full items-center justify-center text-gray-300">
                        <ImageIcon size={18} />
                    </span>
                )}
            </button>
            <p className="mt-1 truncate text-center text-[11px] font-semibold text-gray-800" title={label}>
                {label}
            </p>
            {!disabled && onRemove ? (
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-gray-400 shadow-sm ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600"
                    title="Remove"
                >
                    <X size={11} />
                </button>
            ) : null}
        </div>
    );
}

/**
 * New Condition Photos — select body part, then upload.
 * On Complete, mapped photos replace that body part on the handover report.
 */
export default function VehicleServiceNewConditionPhotoStrip({
    newImages = [],
    existingImages = [],
    resolvedExistingSrc = {},
    disabled = false,
    onPreview,
    onSetBodyPartImage,
    onClearBodyPartImage,
}) {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [pendingBodyPartKey, setPendingBodyPartKey] = useState('');

    const usedKeys = useMemo(() => {
        const used = usedServiceBodyPartKeys(newImages);
        (existingImages || []).forEach((img) => {
            const key = String(img?.bodyPartKey || '').trim();
            if (key) used.add(key);
        });
        return used;
    }, [newImages, existingImages]);

    const availableParts = useMemo(
        () => SERVICE_BODY_PART_OPTIONS.filter((opt) => !usedKeys.has(opt.key)),
        [usedKeys],
    );

    const addedRows = useMemo(() => {
        const rows = [];
        (existingImages || []).forEach((img, idx) => {
            const key = String(img?.bodyPartKey || '').trim();
            const src =
                resolvedExistingSrc[`existing-${idx}`] ||
                (typeof img?.url === 'string' ? img.url : '') ||
                img?.photo ||
                null;
            rows.push({
                id: `existing-${idx}`,
                bodyPartKey: key,
                label: key ? labelForServiceBodyPartKey(key) || key : img?.name || `Saved ${idx + 1}`,
                src,
                removable: false,
            });
        });
        (newImages || []).forEach((img, idx) => {
            const key = String(img?.bodyPartKey || '').trim();
            rows.push({
                id: `new-${idx}-${key}`,
                bodyPartKey: key,
                label: key ? labelForServiceBodyPartKey(key) || key : img?.name || `New ${idx + 1}`,
                src: directDataUrl(img),
                removable: true,
            });
        });
        return rows;
    }, [existingImages, newImages, resolvedExistingSrc]);

    const handleUpload = (file) => {
        if (!file) return;
        const key = String(pendingBodyPartKey || '').trim();
        if (!key) {
            toast({
                variant: 'destructive',
                title: 'Select body part',
                description: 'Choose a body part first, then upload the image.',
            });
            return;
        }

        const check = validateErpJpegFile(file);
        if (!check.ok) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: check.message || 'JPEG under 2 MB required.',
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            onSetBodyPartImage?.(key, {
                name: file.name,
                data: base64,
                mimeType: file.type || 'image/jpeg',
                bodyPartKey: key,
                photoSource: 'new',
            });
            setPendingBodyPartKey('');
        };
        reader.onerror = () => {
            toast({
                variant: 'destructive',
                title: 'Upload failed',
                description: 'Could not read the selected image.',
            });
        };
        reader.readAsDataURL(file);
    };

    const canUpload = !disabled && Boolean(pendingBodyPartKey) && availableParts.length > 0;

    return (
        <div className="space-y-2.5">
            {!disabled ? (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[180px] flex-1">
                        <select
                            className={tireFieldSelect}
                            value={pendingBodyPartKey}
                            onChange={(e) => setPendingBodyPartKey(e.target.value)}
                            disabled={disabled || !availableParts.length}
                            aria-label="Body part"
                        >
                            <option value="">Select body part</option>
                            {availableParts.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <label
                        className={`${tireUploadBtn} ${!canUpload ? 'pointer-events-none opacity-50' : ''}`}
                    >
                        <Upload size={14} />
                        Upload
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="sr-only"
                            accept={ERP_JPEG_ACCEPT}
                            disabled={!canUpload}
                            onChange={(e) => {
                                handleUpload(e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </label>
                </div>
            ) : null}

            {addedRows.length ? (
                <div className="flex flex-wrap gap-3">
                    {addedRows.map((row) => (
                        <AddedPhotoThumb
                            key={row.id}
                            label={row.label}
                            src={row.src}
                            onPreview={onPreview}
                            disabled={disabled}
                            onRemove={
                                row.removable && row.bodyPartKey
                                    ? () => onClearBodyPartImage?.(row.bodyPartKey)
                                    : undefined
                            }
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
