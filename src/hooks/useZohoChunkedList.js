'use client';

import { useCallback, useRef, useState } from 'react';
import axiosInstance from '@/utils/axios';

const CHUNK_LIMIT = 400;

function createSyncToken() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Zoho list loader:
 * - Default: paged local DB (fast, lean payload)
 * - sync:true (Refresh): pull Zoho in chunks, upsert, delete local rows missing in Zoho, then reload page
 *   so ERP listing matches Zoho (add / update / delete).
 */
export function useZohoChunkedList({ endpoint, mapRows, getRowId, organizationId = '' }) {
    const [rows, setRows] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [syncedCount, setSyncedCount] = useState(0);
    const abortRef = useRef(0);
    const listQueryRef = useRef({
        page: 1,
        pageSize: 10,
        search: '',
        sortBy: '',
        sortDir: '',
    });
    const orgId = String(organizationId || '').trim();

    const fetchPage = useCallback(
        async (listQuery, requestId) => {
            const response = await axiosInstance.get(endpoint, {
                skipToast: true,
                timeout: 30000,
                params: {
                    sync: 'false',
                    page: listQuery.page,
                    pageSize: listQuery.pageSize,
                    search: listQuery.search || undefined,
                    sortBy: listQuery.sortBy || undefined,
                    sortDir: listQuery.sortDir || undefined,
                    ...(orgId ? { organizationId: orgId } : {}),
                },
            });

            if (abortRef.current !== requestId) return null;

            const meta = response?.data?.meta || {};
            const mapped = mapRows(response?.data?.data);
            setRows(mapped);
            setTotalCount(Number(meta.total ?? mapped.length) || 0);
            return mapped;
        },
        [endpoint, mapRows, orgId],
    );

    const load = useCallback(
        async ({
            sync = false,
            page,
            pageSize,
            search,
            sortBy,
            sortDir,
        } = {}) => {
            const requestId = abortRef.current + 1;
            abortRef.current = requestId;

            const nextQuery = {
                ...listQueryRef.current,
                ...(page !== undefined ? { page } : {}),
                ...(pageSize !== undefined ? { pageSize } : {}),
                ...(search !== undefined ? { search } : {}),
                ...(sortBy !== undefined ? { sortBy } : {}),
                ...(sortDir !== undefined ? { sortDir } : {}),
            };
            listQueryRef.current = nextQuery;

            setLoading(true);
            setLoadingMore(false);
            setError('');
            if (sync) setSyncedCount(0);

            try {
                try {
                    await fetchPage(nextQuery, requestId);
                    if (abortRef.current !== requestId) return;
                    setLoading(false);
                } catch (cacheErr) {
                    if (!sync) throw cacheErr;
                    setRows([]);
                    setTotalCount(0);
                    setLoading(false);
                }

                if (!sync) return;

                // Refresh: sync Zoho in background, then reload the current page
                setLoadingMore(true);
                const syncToken = createSyncToken();
                let zohoPage = 1;
                let totalSynced = 0;
                let totalRemoved = 0;

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
                            ...(orgId ? { organizationId: orgId } : {}),
                        },
                    });

                    if (abortRef.current !== requestId) return;

                    const chunkCount = Array.isArray(response?.data?.data)
                        ? response.data.data.length
                        : Number(response?.data?.meta?.upserted) || 0;
                    totalSynced += chunkCount;
                    totalRemoved += Number(response?.data?.meta?.deactivated) || 0;
                    setSyncedCount(totalSynced);

                    const meta = response?.data?.meta || {};
                    if (!meta.hasMore) break;
                    zohoPage = Number(meta.nextZohoPage) || zohoPage + 2;
                }

                if (abortRef.current !== requestId) return;
                await fetchPage(listQueryRef.current, requestId);
                if (totalRemoved > 0) {
                    setError('');
                    console.info(
                        `[Zoho sync] upserted ${totalSynced}, removed ${totalRemoved} local row(s) missing in Zoho`,
                    );
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
        },
        [endpoint, fetchPage, orgId],
    );

    return {
        rows,
        setRows,
        totalCount,
        loading,
        loadingMore,
        error,
        setError,
        syncedCount,
        load,
        chunkLimit: CHUNK_LIMIT,
        getRowId,
    };
}
