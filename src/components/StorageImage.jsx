'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useStorageObjectUrl } from '@/hooks/useStorageObjectUrl';

/**
 * Renders a private storage image via API proxy (works when Wasabi DNS fails in the browser).
 */
export default function StorageImage({
    src,
    alt = '',
    className = 'w-full h-full object-cover',
    onClick,
    placeholderClassName = 'w-full h-full flex items-center justify-center bg-slate-50 text-slate-300',
}) {
    const { url, loading, failed } = useStorageObjectUrl(src);

    if (loading && !url) {
        return (
            <div className={placeholderClassName}>
                <Loader2 className="h-5 w-5 animate-spin opacity-60" />
            </div>
        );
    }

    if (!url || failed) {
        return (
            <div className={placeholderClassName}>
                <Camera size={28} strokeWidth={1.25} className="opacity-40" />
            </div>
        );
    }

    return (
        <img
            src={url}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
            onClick={onClick}
        />
    );
}
