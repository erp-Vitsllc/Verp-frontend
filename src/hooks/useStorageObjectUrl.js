'use client';

import { useEffect, useRef, useState } from 'react';
import {
    extractStorageReference,
    loadStorageFileBlob,
    looksLikeS3StorageKey,
} from '@/utils/attachmentPreview';

function isDirectBrowserUrl(value) {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (!s) return false;
    if (s.startsWith('data:') || s.startsWith('blob:')) return true;
    // Local/dev asset paths only — never use remote Wasabi signed URLs in <img>
    // (Windows/ISP DNS often cannot resolve wasabisys.com).
    if (s.startsWith('/') && !looksLikeS3StorageKey(s.replace(/^\//, ''))) return true;
    return false;
}

function resolveStorageKey(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (isDirectBrowserUrl(trimmed)) return null;
        const ref = extractStorageReference(trimmed);
        return ref?.key || null;
    }
    const ref = extractStorageReference(value);
    return ref?.key || null;
}

/**
 * Load private storage images via authenticated /storage/file proxy → blob URL.
 * Avoids browser DNS/CORS failures against Wasabi signed URLs.
 */
export function useStorageObjectUrl(source) {
    const [url, setUrl] = useState(() => (isDirectBrowserUrl(source) ? String(source).trim() : null));
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const objectUrlRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const revoke = () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };

        if (isDirectBrowserUrl(source)) {
            revoke();
            setUrl(String(source).trim());
            setLoading(false);
            setFailed(false);
            return () => {
                cancelled = true;
            };
        }

        const key = resolveStorageKey(source);
        if (!key) {
            revoke();
            setUrl(null);
            setLoading(false);
            setFailed(Boolean(source));
            return () => {
                cancelled = true;
            };
        }

        setLoading(true);
        setFailed(false);

        loadStorageFileBlob(key)
            .then((blob) => {
                if (cancelled) return;
                revoke();
                const objectUrl = URL.createObjectURL(blob);
                objectUrlRef.current = objectUrl;
                setUrl(objectUrl);
                setLoading(false);
                setFailed(false);
            })
            .catch(() => {
                if (cancelled) return;
                revoke();
                setUrl(null);
                setLoading(false);
                setFailed(true);
            });

        return () => {
            cancelled = true;
            revoke();
        };
    }, [typeof source === 'string' ? source : JSON.stringify(source)]);

    return { url, loading, failed };
}
