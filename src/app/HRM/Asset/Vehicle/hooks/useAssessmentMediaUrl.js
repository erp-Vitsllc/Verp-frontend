'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    hasStoredAssessmentPhoto,
    normalizeHandoverPhotoIdentity,
    resolveAssessmentMediaUrl,
} from '../utils/vehicleHandoverReceiverAssessment';
import { fetchSignedAssessmentMediaUrl } from '../utils/vehicleHandoverImageUtils';

function mediaDependencyKey(value) {
    if (!value) return '';
    if (typeof value === 'string') {
        return normalizeHandoverPhotoIdentity(value) || value.trim();
    }
    return normalizeHandoverPhotoIdentity(value) || JSON.stringify(value);
}

export default function useAssessmentMediaUrl(photo) {
    const [url, setUrl] = useState(() => resolveAssessmentMediaUrl(photo));
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const retryCountRef = useRef(0);
    const depKey = mediaDependencyKey(photo);

    useEffect(() => {
        retryCountRef.current = 0;

        if (!hasStoredAssessmentPhoto(photo)) {
            setUrl(null);
            setFailed(false);
            setLoading(false);
            return undefined;
        }

        const direct = resolveAssessmentMediaUrl(photo);
        if (direct?.startsWith('data:')) {
            setUrl(direct);
            setFailed(false);
            setLoading(false);
            return undefined;
        }

        const storageKey = normalizeHandoverPhotoIdentity(photo);
        if (!storageKey || storageKey.startsWith('data:')) {
            setUrl(direct);
            setFailed(!direct);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setFailed(false);
        fetchSignedAssessmentMediaUrl(photo).then((signed) => {
            if (cancelled) return;
            setUrl(signed || direct || null);
            setFailed(!(signed || direct));
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [depKey, photo]);

    const retry = useCallback(() => {
        if (!hasStoredAssessmentPhoto(photo)) return;
        if (retryCountRef.current >= 2) {
            setFailed(true);
            return;
        }
        retryCountRef.current += 1;
        setLoading(true);
        fetchSignedAssessmentMediaUrl(photo).then((signed) => {
            setUrl(signed);
            setFailed(!signed);
            setLoading(false);
        });
    }, [photo]);

    return { url, loading, failed, retry };
}
