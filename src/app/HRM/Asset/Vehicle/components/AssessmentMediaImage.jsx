'use client';

import { ImageIcon, Loader2 } from 'lucide-react';
import useAssessmentMediaUrl from '../hooks/useAssessmentMediaUrl';

export default function AssessmentMediaImage({
    photo,
    alt = '',
    className = 'h-full w-full object-cover object-center',
    fit = 'cover',
    onClick,
    placeholderClassName = 'h-full w-full',
    buttonClassName = 'h-full w-full',
}) {
    const { url, loading, failed, retry } = useAssessmentMediaUrl(photo);

    if (loading && !url) {
        return (
            <div className={`flex items-center justify-center ${placeholderClassName}`}>
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!url || failed) {
        return (
            <div className={`flex items-center justify-center ${placeholderClassName}`}>
                <ImageIcon className="text-gray-300" size={20} strokeWidth={1.5} />
            </div>
        );
    }

    const fitClass =
        fit === 'contain'
            ? 'max-h-full max-w-full object-contain object-center'
            : className;

    const image = (
        <img
            src={url}
            alt={alt}
            className={fitClass}
            loading="lazy"
            decoding="async"
            onError={retry}
        />
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={buttonClassName}>
                {image}
            </button>
        );
    }

    return image;
}
