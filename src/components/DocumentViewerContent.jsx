'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Download, ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';
import { sanitizeUrl } from '@/utils/security';
import {
    loadStorageFileBlob,
    ensureDownloadFilename,
    isNonDocumentResponseContentType,
} from '@/utils/attachmentPreview';

function blobToObjectUrl(blob, mimeType) {
    const typed = blob.type ? blob : new Blob([blob], { type: mimeType || 'application/pdf' });
    return window.URL.createObjectURL(typed);
}

export default function DocumentViewerContent({
    viewingDocument,
    onClose,
    showClose = true,
    embedded = false,
    hideToolbar = false,
}) {
    const { toast } = useToast();
    const [documentSrc, setDocumentSrc] = useState(null);
    const [isLoadingSrc, setIsLoadingSrc] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [zoom, setZoom] = useState(100);
    const blobUrlRef = useRef(null);

    const usesStorageProxy = Boolean(viewingDocument?.storageRef);
    const isLoading =
        viewingDocument?.loading ||
        (usesStorageProxy ? isLoadingSrc : !viewingDocument?.data && !usesStorageProxy);

    useEffect(() => {
        setDocumentSrc(null);
        setIsLoadingSrc(false);
        setLoadError(null);
        setZoom(100);

        if (blobUrlRef.current) {
            window.URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        if (!viewingDocument || viewingDocument.loading) {
            return undefined;
        }

        let cancelled = false;

        const finishWithBlob = (blob, mimeType) => {
            if (cancelled) return;
            const url = blobToObjectUrl(blob, mimeType);
            blobUrlRef.current = url;
            setDocumentSrc(`${url}#toolbar=0`);
            setIsLoadingSrc(false);
        };

        const fail = (message) => {
            if (cancelled) return;
            setLoadError(message);
            setIsLoadingSrc(false);
        };

        if (usesStorageProxy) {
            setIsLoadingSrc(true);
            loadStorageFileBlob(viewingDocument.storageRef)
                .then((blob) => finishWithBlob(blob, viewingDocument.mimeType))
                .catch((err) => {
                    fail(
                        err.response?.data?.message ||
                            err.message ||
                            'Could not load file from storage.',
                    );
                });
            return () => {
                cancelled = true;
            };
        }

        const docData = viewingDocument?.data;
        if (!docData) {
            return undefined;
        }

        if (typeof docData === 'string' && docData.startsWith('data:')) {
            setDocumentSrc(`${docData}#toolbar=0`);
            return undefined;
        }

        if (
            typeof docData === 'string' &&
            (docData.startsWith('http://') || docData.startsWith('https://'))
        ) {
            setIsLoadingSrc(true);
            fetch(docData, { mode: 'cors', credentials: 'omit' })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(
                            response.status === 404
                                ? 'Document not found on server (404).'
                                : `Failed to load document (Status: ${response.status})`,
                        );
                    }
                    const headerType = (response.headers.get('content-type') || '').toLowerCase();
                    if (isNonDocumentResponseContentType(headerType)) {
                        throw new Error('Server returned an error instead of the file.');
                    }
                    const blobData = await response.blob();
                    if (isNonDocumentResponseContentType(blobData.type)) {
                        throw new Error('File missing or link expired.');
                    }
                    finishWithBlob(blobData, viewingDocument.mimeType);
                })
                .catch((err) => fail(err.message || 'Could not load document.'));
            return () => {
                cancelled = true;
            };
        }

        try {
            let cleanData = docData;
            if (typeof cleanData === 'string' && cleanData.includes(',')) {
                cleanData = cleanData.split(',')[1];
            }
            const mimeType = viewingDocument.mimeType || 'application/pdf';
            setDocumentSrc(`data:${mimeType};base64,${cleanData}#toolbar=0`);
        } catch {
            fail('Invalid document data format.');
        }

        return () => {
            cancelled = true;
        };
    }, [
        viewingDocument,
        viewingDocument?.loading,
        viewingDocument?.storageRef,
        viewingDocument?.data,
        viewingDocument?.mimeType,
        usesStorageProxy,
    ]);

    useEffect(() => () => {
        if (blobUrlRef.current) {
            window.URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
    }, []);

    const allowDownload = viewingDocument?.allowDownload !== false;

    const handleDownload = useCallback(async () => {
        if (isLoading || loadError) return;
        try {
            const mime = viewingDocument.mimeType || 'application/pdf';
            let blob;

            if (viewingDocument.storageRef) {
                blob = await loadStorageFileBlob(viewingDocument.storageRef);
            } else if (
                typeof viewingDocument.data === 'string' &&
                viewingDocument.data.startsWith('data:')
            ) {
                const raw = viewingDocument.data.includes(',')
                    ? viewingDocument.data.split(',')[1]
                    : viewingDocument.data;
                const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
                blob = new Blob([bytes], { type: mime });
            } else if (
                typeof viewingDocument.data === 'string' &&
                (viewingDocument.data.startsWith('http://') ||
                    viewingDocument.data.startsWith('https://'))
            ) {
                const response = await fetch(viewingDocument.data, { credentials: 'omit' });
                if (!response.ok) throw new Error('Download failed');
                blob = await response.blob();
                if (isNonDocumentResponseContentType(blob.type)) {
                    throw new Error('File not found in storage.');
                }
            } else {
                let base64Data = viewingDocument.data;
                if (base64Data.includes(',')) base64Data = base64Data.split(',')[1];
                const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
                blob = new Blob([bytes], { type: mime });
            }

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = sanitizeUrl(url);
            link.rel = 'noopener noreferrer';
            link.download = ensureDownloadFilename(viewingDocument.name, mime);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Download failed',
                description:
                    error.response?.data?.message ||
                    error.message ||
                    'Failed to download. The file may be missing — try re-uploading.',
            });
        }
    }, [isLoading, loadError, viewingDocument, toast]);

    const zoomIn = () => setZoom((z) => Math.min(300, z + 25));
    const zoomOut = () => setZoom((z) => Math.max(50, z - 25));
    const resetZoom = () => setZoom(100);

    const mime = viewingDocument?.mimeType?.toLowerCase() || '';
    const name = viewingDocument?.name?.toLowerCase() || '';
    const isImage = mime.startsWith('image/') || /\.(jpg|jpeg|png)$/.test(name);
    const isPdf = mime.includes('pdf') || name.endsWith('.pdf');

    return (
        <div className={`flex flex-col bg-slate-100 ${embedded ? 'h-full min-h-[640px] rounded-b-2xl' : 'min-h-screen'}`}>
            {!hideToolbar && (
            <header className={`sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-slate-200 shadow-sm ${embedded ? 'rounded-none' : ''}`}>
                <h1 className="text-base font-semibold text-slate-800 truncate min-w-0">
                    {viewingDocument?.name || 'Document'}
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={isLoading || !!loadError || zoom <= 50}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        title="Zoom out"
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-xs font-semibold text-slate-500 w-12 text-center">{zoom}%</span>
                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={isLoading || !!loadError || zoom >= 300}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        title="Zoom in"
                    >
                        <ZoomIn size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={resetZoom}
                        disabled={isLoading || !!loadError || zoom === 100}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        title="Reset zoom"
                    >
                        <RotateCcw size={18} />
                    </button>
                    {allowDownload && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isLoading || !!loadError}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                            title="Download"
                        >
                            <Download size={16} />
                            Download
                        </button>
                    )}
                    {showClose && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                            title="Close tab"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </header>
            )}

            <main className={`flex-1 overflow-auto ${embedded ? 'p-2' : 'p-4'} ${hideToolbar ? 'p-0' : ''}`}>
                {loadError ? (
                    <div className={`flex flex-col items-center justify-center text-center p-8 ${embedded ? 'min-h-[480px]' : 'min-h-[60vh]'}`}>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Unable to load document</h2>
                        <p className="text-slate-500 max-w-md">{loadError}</p>
                    </div>
                ) : isLoading || !documentSrc ? (
                    <div className={`flex items-center justify-center ${embedded ? 'min-h-[480px]' : 'min-h-[60vh]'}`}>
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3" />
                            <p className="text-slate-600 font-medium">Loading document...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <div
                            style={{
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: 'top center',
                                width: `${10000 / zoom}%`,
                            }}
                        >
                            {isImage && !isPdf ? (
                                <img
                                    src={sanitizeUrl(documentSrc)}
                                    alt={viewingDocument.name}
                                    className="max-w-full h-auto mx-auto shadow-md rounded border border-slate-200 bg-white"
                                />
                            ) : (
                                <embed
                                    src={sanitizeUrl(documentSrc)}
                                    type="application/pdf"
                                    className={`w-full border-0 bg-white shadow-md rounded ${embedded ? 'min-h-[600px]' : 'min-h-[85vh]'}`}
                                    title={viewingDocument.name}
                                />
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
