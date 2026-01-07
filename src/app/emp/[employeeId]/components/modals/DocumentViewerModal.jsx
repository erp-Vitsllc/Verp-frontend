'use client';

import { useState, useEffect, useRef } from 'react';
import { isAdmin, hasPermission } from '@/utils/permissions';

export default function DocumentViewerModal({
    isOpen,
    onClose,
    viewingDocument
}) {
    const [documentSrc, setDocumentSrc] = useState(null);
    const [isLoadingSrc, setIsLoadingSrc] = useState(false);
    const blobUrlRef = useRef(null);

    if (!isOpen) return null;

    // Handle loading state
    const isLoading = viewingDocument?.loading || !viewingDocument?.data;

    // Convert Cloudinary URLs to blob URLs for viewing to prevent auto-download
    useEffect(() => {
        // Reset state when document changes
        setDocumentSrc(null);
        setIsLoadingSrc(false);

        // Cleanup previous blob URL if exists
        if (blobUrlRef.current) {
            window.URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        if (!viewingDocument?.data || isLoading) {
            setDocumentSrc(null);
            setIsLoadingSrc(false);
            return;
        }

        const isCloudinaryUrl = viewingDocument.data &&
            (viewingDocument.data.startsWith('http://') ||
                viewingDocument.data.startsWith('https://') ||
                viewingDocument.data.includes('cloudinary.com'));

        if (isCloudinaryUrl) {
            // Convert Cloudinary URL to blob URL for safe viewing (prevents auto-download)
            setIsLoadingSrc(true);
            fetch(viewingDocument.data, {
                mode: 'cors',
                credentials: 'omit'
            })
                .then(async response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    // Force PDF MIME type - Cloudinary returns application/octet-stream for raw files
                    // but we know it's a PDF from viewingDocument.mimeType
                    const contentType = viewingDocument.mimeType || 'application/pdf';
                    const blobData = await response.blob();
                    // Create a new blob with the correct MIME type (force PDF)
                    const typedBlob = new Blob([blobData], { type: contentType });

                    // Convert blob to data URL for better PDF display in iframe
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result;
                        // Append #toolbar=0 to hide browser PDF toolbar
                        setDocumentSrc(`${dataUrl}#toolbar=0`);
                        setIsLoadingSrc(false);
                    };
                    reader.onerror = () => {
                        // Fallback to blob URL if data URL conversion fails
                        const blobUrl = window.URL.createObjectURL(typedBlob);
                        blobUrlRef.current = blobUrl;
                        // Append #toolbar=0 to hide browser PDF toolbar
                        setDocumentSrc(`${blobUrl}#toolbar=0`);
                        setIsLoadingSrc(false);
                    };
                    reader.readAsDataURL(typedBlob);
                })
                .catch(error => {
                    // Fallback: Use Cloudinary URL directly but add fl_inline to prevent download
                    let url = viewingDocument.data;
                    // Remove any fl_attachment parameter
                    url = url.replace(/[?&]fl_attachment[^&]*/g, '');
                    // Add fl_inline parameter to force inline display
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}fl_inline#toolbar=0`;
                    setDocumentSrc(url);
                    setIsLoadingSrc(false);
                });
        } else {
            // Handle base64 data
            let cleanData = viewingDocument.data;
            if (cleanData.includes(',')) {
                cleanData = cleanData.split(',')[1];
            }
            const mimeType = viewingDocument.mimeType || 'application/pdf';
            // Append #toolbar=0 to hide browser PDF toolbar
            setDocumentSrc(`data:${mimeType};base64,${cleanData}#toolbar=0`);
        }

        // Cleanup on unmount
        return () => {
            if (blobUrlRef.current) {
                window.URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [viewingDocument?.data, isLoading]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">{viewingDocument.name}</h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={async () => {
                                if (isLoading) return;
                                try {
                                    // Check if it's a Cloudinary URL
                                    const isCloudinaryUrl = viewingDocument.data &&
                                        (viewingDocument.data.startsWith('http://') ||
                                            viewingDocument.data.startsWith('https://') ||
                                            viewingDocument.data.includes('cloudinary.com'));

                                    if (isCloudinaryUrl) {
                                        // For Cloudinary URLs, fetch as blob to download with proper filename
                                        const response = await fetch(viewingDocument.data);
                                        const blob = await response.blob();

                                        // Create download link with proper filename
                                        const url = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = viewingDocument.name || 'document.pdf';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(url);
                                    } else {
                                        // Handle base64 data - remove data URL prefix if present
                                        let base64Data = viewingDocument.data;
                                        if (base64Data.includes(',')) {
                                            base64Data = base64Data.split(',')[1];
                                        }

                                        // Convert base64 to blob
                                        const byteCharacters = atob(base64Data);
                                        const byteNumbers = new Array(byteCharacters.length);
                                        for (let i = 0; i < byteCharacters.length; i++) {
                                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                                        }
                                        const byteArray = new Uint8Array(byteNumbers);
                                        const blob = new Blob([byteArray], { type: viewingDocument.mimeType || 'application/pdf' });

                                        // Create download link with proper filename
                                        const url = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = viewingDocument.name || 'document.pdf';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(url);
                                    }
                                } catch (error) {
                                    alert('Failed to download document. Please try again.');
                                }
                            }}
                            disabled={isLoading}
                            className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Download Document"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                        </button>
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
                <div className="flex-1 overflow-auto p-4 bg-gray-100">
                    {(isLoading || isLoadingSrc || !documentSrc) ? (
                        <div className="flex items-center justify-center h-full min-h-[600px]">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                <p className="text-gray-600 font-medium">Loading document...</p>
                            </div>
                        </div>
                    ) : documentSrc ? (
                        // Render iframe/image when we have documentSrc
                        // By this point, Cloudinary URLs should have been converted to blob URLs
                        (() => {
                            const isPdf = viewingDocument.mimeType?.includes('pdf') ||
                                (!viewingDocument.mimeType && (
                                    documentSrc.startsWith('blob:') ||
                                    documentSrc.startsWith('data:') ||
                                    documentSrc.includes('.pdf') ||
                                    documentSrc.includes('application/pdf')
                                ));

                            return isPdf ? (
                                <div className="w-full h-full min-h-[600px]" style={{ position: 'relative' }}>
                                    <embed
                                        key={documentSrc} // Force re-render when src changes
                                        src={documentSrc}
                                        type="application/pdf"
                                        className="w-full h-full border-0"
                                        title={viewingDocument.name}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            height: '100%',
                                            minHeight: '600px',
                                            border: 'none'
                                        }}
                                    />
                                </div>
                            ) : (
                                <img
                                    key={documentSrc}
                                    src={documentSrc}
                                    alt={viewingDocument.name}
                                    className="max-w-full h-auto mx-auto"
                                    onLoad={() => { }}
                                    onError={() => { }}
                                />
                            );
                        })()
                    ) : (
                        <div className="flex items-center justify-center h-full min-h-[600px]">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                <p className="text-gray-600 font-medium">Preparing document for viewing...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


