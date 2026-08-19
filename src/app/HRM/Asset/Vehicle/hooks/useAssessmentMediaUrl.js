'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    hasStoredAssessmentPhoto,
    normalizeHandoverPhotoIdentity,
    resolveAssessmentMediaUrl,
} from '../utils/vehicleHandoverReceiverAssessment';
import {
    fetchSignedAssessmentMediaUrl,
    peekCachedAssessmentMediaUrl,
    resolveAssessmentStorageProxyKey,
} from '../utils/vehicleHandoverImageUtils';

function mediaDependencyKey(value) {
    if (!value) return '';
    const proxyKey = resolveAssessmentStorageProxyKey(value);
    if (proxyKey) return proxyKey;
    if (typeof value === 'string') {
        return normalizeHandoverPhotoIdentity(value) || value.trim();
    }
    return normalizeHandoverPhotoIdentity(value) || JSON.stringify(value);
}

function immediateDisplayUrl(photo) {
    const direct = resolveAssessmentMediaUrl(photo);
    if (direct?.startsWith('data:') || direct?.startsWith('blob:')) return direct;
    return peekCachedAssessmentMediaUrl(photo);
}

export default function useAssessmentMediaUrl(photo) {
    const [url, setUrl] = useState(() => immediateDisplayUrl(photo));
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const retryCountRef = useRef(0);
    const requestKeyRef = useRef(mediaDependencyKey(photo));
    const photoRef = useRef(photo);
    photoRef.current = photo;
    const depKey = mediaDependencyKey(photo);

    useEffect(() => {
        retryCountRef.current = 0;
        requestKeyRef.current = depKey;
        const currentPhoto = photoRef.current;

        if (!hasStoredAssessmentPhoto(currentPhoto)) {
            setUrl(null);
            setFailed(false);
            setLoading(false);
            return undefined;
        }

        const ready = immediateDisplayUrl(currentPhoto);
        if (ready) {
            setUrl(ready);
            setFailed(false);
            setLoading(false);
            return undefined;
        }

        const storageKey = resolveAssessmentStorageProxyKey(currentPhoto);
        if (!storageKey || storageKey.startsWith('data:') || storageKey.startsWith('blob:')) {
            setUrl(null);
            setFailed(true);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        // Drop the previous slot's blob immediately so a slow fetch cannot flash the wrong view.
        setUrl(null);
        setLoading(true);
        setFailed(false);
        const startedKey = depKey;

        const load = (attempt) => {
            fetchSignedAssessmentMediaUrl(currentPhoto, { skipCache: attempt > 0 })
                .then((signed) => {
                    if (cancelled || requestKeyRef.current !== startedKey) return;
                    if (!signed && attempt < 2) {
                        window.setTimeout(() => {
                            if (cancelled || requestKeyRef.current !== startedKey) return;
                            load(attempt + 1);
                        }, 400 * (attempt + 1));
                        return;
                    }
                    setUrl(signed || null);
                    setFailed(!signed);
                    setLoading(false);
                })
                .catch(() => {
                    if (cancelled || requestKeyRef.current !== startedKey) return;
                    if (attempt < 2) {
                        load(attempt + 1);
                        return;
                    }
                    setUrl(null);
                    setFailed(true);
                    setLoading(false);
                });
        };
        load(0);

        return () => {
            cancelled = true;
        };
    }, [depKey]);

    const retry = useCallback(() => {
        const currentPhoto = photoRef.current;
        const startedKey = mediaDependencyKey(currentPhoto);
        if (!hasStoredAssessmentPhoto(currentPhoto)) return;
        if (retryCountRef.current >= 2) {
            setFailed(true);
            return;
        }
        retryCountRef.current += 1;
        setLoading(true);
        fetchSignedAssessmentMediaUrl(currentPhoto, { skipCache: true }).then((signed) => {
            if (requestKeyRef.current !== startedKey) return;
            setUrl(signed);
            setFailed(!signed);
            setLoading(false);
        });
    }, []);

    return { url, loading, failed, retry };
}
