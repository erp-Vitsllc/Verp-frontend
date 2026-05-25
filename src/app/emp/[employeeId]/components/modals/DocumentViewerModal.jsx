'use client';

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
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

export default function DocumentViewerModal({
    isOpen,
    onClose,
    viewingDocument
}) {
    const [documentSrc, setDocumentSrc] = useState(null);
    const [isLoadingSrc, setIsLoadingSrc] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const blobUrlRef = useRef(null);

    const usesStorageProxy = Boolean(viewingDocument?.storageRef);
    const isLoading =
        viewingDocument?.loading ||
        (usesStorageProxy ? isLoadingSrc : !viewingDocument?.data);

    useEffect(() => {
        setDocumentSrc(null);
        setIsLoadingSrc(false);
        setLoadError(null);

        if (blobUrlRef.current) {
            window.URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        if (!isOpen || viewingDocument?.loading) {
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
                    const msg =
                        err.response?.data?.message ||
                        err.message ||
                        'Could not load file from storage.';
                    fail(msg);
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
        isOpen,
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

    if (!isOpen) return null;

    const allowDownload = viewingDocument?.allowDownload !== false;

    const handleDownload = async () => {
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
                (viewingDocument.data.startsWith('http://') || viewingDocument.data.startsWith('https://'))
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
            alert(
                error.response?.data?.message ||
                    error.message ||
                    'Failed to download. The file may be missing — try re-uploading.',
            );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">{viewingDocument.name}</h3>
                    <div className="flex items-center gap-3">
                        {allowDownload && (
                            <button
                                onClick={handleDownload}
                                disabled={isLoading || !!loadError}
                                className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${isLoading || loadError ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Download Document"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 p-2"
                            title="Close"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-4 bg-gray-100 flex flex-col">
                    {loadError ? (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-center p-8">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <h4 className="text-lg font-bold text-gray-800 mb-2">Unable to load document</h4>
                            <p className="text-gray-500 max-w-sm mx-auto mb-6">{loadError}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
                            >
                                Close Viewer
                            </button>
                        </div>
                    ) : isLoading || !documentSrc ? (
                        <div className="flex items-center justify-center h-full min-h-[600px]">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                <p className="text-gray-600 font-medium">Loading document...</p>
                            </div>
                        </div>
                    ) : (
                        (() => {
                            const mime = viewingDocument.mimeType?.toLowerCase() || '';
                            const name = viewingDocument.name?.toLowerCase() || '';
                            const isImage =
                                mime.startsWith('image/') ||
                                /\.(jpg|jpeg|png)$/.test(name);
                            const isPdf =
                                mime.includes('pdf') || name.endsWith('.pdf');

                            if (isImage && !isPdf) {
                                return (
                                    <img
                                        src={sanitizeUrl(documentSrc)}
                                        alt={viewingDocument.name}
                                        className="max-w-full h-auto mx-auto shadow-sm rounded border border-gray-200"
                                    />
                                );
                            }

                            return (
                                <embed
                                    src={sanitizeUrl(documentSrc)}
                                    type="application/pdf"
                                    className="w-full h-full min-h-[600px] border-0"
                                    title={viewingDocument.name}
                                />
                            );
                        })()
                    )}
                </div>
            </div>
        </div>
    );
}
