'use client';

import { useCallback, useRef, useState } from 'react';
import axiosInstance from '@/utils/axios';

const CHUNK_LIMIT = 400;

function createSyncToken() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Progressive Zoho list loader:
 * 1) Show local DB cache immediately (if any)
 * 2) Sync from Zoho in chunks of 400 and merge into the table
 */
export function useZohoChunkedList({ endpoint, mapRows, getRowId }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [syncedCount, setSyncedCount] = useState(0);
    const abortRef = useRef(0);

    const mergeRows = useCallback(
        (incoming) => {
            setRows((prev) => {
                const byId = new Map();
                prev.forEach((row) => {
                    const id = getRowId(row);
                    if (id) byId.set(id, row);
                });
                incoming.forEach((row) => {
                    const id = getRowId(row);
                    if (id) byId.set(id, row);
                });
                return Array.from(byId.values());
            });
        },
        [getRowId],
    );

    const load = useCallback(async () => {
        const requestId = abortRef.current + 1;
        abortRef.current = requestId;

        setLoading(true);
        setLoadingMore(false);
        setError('');
        setSyncedCount(0);
        let painted = false;

        try {
            // 1) Instant cache paint
            try {
                const cached = await axiosInstance.get(endpoint, {
                    skipToast: true,
                    timeout: 30000,
                    params: { sync: 'false' },
                });
                if (abortRef.current !== requestId) return;

                const cachedRows = mapRows(cached?.data?.data);
                if (cachedRows.length) {
                    setRows(cachedRows);
                    painted = true;
                    setLoading(false);
                    setLoadingMore(true);
                } else {
                    setRows([]);
                }
            } catch {
                // Cache miss is fine — continue with Zoho chunks
            }

            // 2) Progressive Zoho sync in chunks of 400
            const syncToken = createSyncToken();
            let zohoPage = 1;
            let totalSynced = 0;

            while (true) {
                if (abortRef.current !== requestId) return;

                const response = await axiosInstance.get(endpoint, {
                    skipToast: true,
                    timeout: 120000,
                    params: {
                        sync: 'true',
                        zohoPage,
                        chunkLimit: CHUNK_LIMIT,
                        syncToken,
                    },
                });

                if (abortRef.current !== requestId) return;

                const chunkRows = mapRows(response?.data?.data);
                totalSynced += chunkRows.length;
                setSyncedCount(totalSynced);
                mergeRows(chunkRows);

                if (!painted) {
                    painted = true;
                    setLoading(false);
                }

                const meta = response?.data?.meta || {};
                setLoadingMore(Boolean(meta.hasMore));
                if (!meta.hasMore) break;

                zohoPage = Number(meta.nextZohoPage) || zohoPage + 2;
            }
        } catch (err) {
            if (abortRef.current !== requestId) return;
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to load data from Zoho Books';
            setError(message);
        } finally {
            if (abortRef.current === requestId) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [endpoint, mapRows, mergeRows]);

    return {
        rows,
        setRows,
        loading,
        loadingMore,
        error,
        setError,
        syncedCount,
        load,
        chunkLimit: CHUNK_LIMIT,
    };
}
