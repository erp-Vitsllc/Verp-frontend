'use client';

import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { resolveAttachmentDisplayName } from '@/utils/storedAttachmentFileName';

export default function VehicleEditAttachmentField({
    fileName = '',
    existingUrl = '',
    localFile = null,
    hasNewFile = false,
    accept,
    disabled = false,
    error = false,
    onFileChange,
    emptyLabel = 'Click to upload',
}) {
    const inputRef = useRef(null);
    const { toast } = useToast();
    const displayName = hasNewFile
        ? String(fileName || localFile?.name || 'New file').trim()
        : resolveAttachmentDisplayName({ fileName, existingUrl });
    const canOpenStored = Boolean(String(existingUrl || '').trim()) && !hasNewFile;
    const canOpenLocal = hasNewFile && localFile instanceof File;
    const hasFile = Boolean(displayName || canOpenStored || canOpenLocal);

    const openFile = async () => {
        if (canOpenLocal) {
            const url = URL.createObjectURL(localFile);
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        if (!canOpenStored) return;
        try {
            await openAttachmentInNewTab(existingUrl, { name: displayName || 'Attachment' });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Cannot open attachment',
                description: err?.message || 'Failed to open file.',
            });
        }
    };

    return (
        <div
            className={`flex items-center gap-1.5 min-h-9 rounded-lg border px-2 ${
                error ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50'
            }`}
        >
            <span
                className={`flex-1 min-w-0 truncate text-[11px] font-bold ${
                    displayName ? 'text-slate-700' : 'text-slate-400'
                }`}
                title={displayName || emptyLabel}
            >
                {displayName || emptyLabel}
            </span>
            {hasFile ? (
                <>
                    <button
                        type="button"
                        disabled={disabled || (!canOpenStored && !canOpenLocal)}
                        onClick={openFile}
                        className="shrink-0 h-7 px-2 rounded-md text-[10px] font-black uppercase tracking-wide text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                    >
                        Open
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                        className="shrink-0 h-7 px-2 rounded-md text-[10px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-100"
                    >
                        Edit
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                    className="shrink-0 h-7 px-2 rounded-md text-[10px] font-black uppercase tracking-wide text-blue-600 hover:bg-blue-50"
                >
                    Add
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                disabled={disabled}
                className="hidden"
                onChange={onFileChange}
            />
        </div>
    );
}
