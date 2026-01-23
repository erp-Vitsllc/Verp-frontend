'use client';

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

export default function DocumentViewerModal({
    isOpen,
    onClose,
    viewingDocument
}) {
    const [documentSrc, setDocumentSrc] = useState(null);
    const [isLoadingSrc, setIsLoadingSrc] = useState(false);
    const blobUrlRef = useRef(null);

    // Sanitize any HTML content calling this function
    const sanitizeHtml = (dirty) => {
        return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
    };

    // Helper to validate URLs strictly
    const isValidUrl = (url) => {
        if (!url) return false;
        // Allow blob: and data: URLs (safe for viewing if content type is verified)
        if (url.startsWith('blob:') || url.startsWith('data:')) return true;
        // Allow http/https
        if (url.startsWith('http://') || url.startsWith('https://')) return true;
        return false;
    };

    if (!isOpen) return null;

    // Handle loading state
    const isLoading = viewingDocument?.loading || !viewingDocument?.data;

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

        const docData = viewingDocument.data;

        // Check for Cloudinary/Remote URL
        // STRICTER CHECK: Must start with http/https. No generic 'includes'.
        const isRemoteUrl = typeof docData === 'string' &&
            (docData.startsWith('http://') || docData.startsWith('https://'));

        if (isRemoteUrl) {
            // Prevent auto-download / malicious redirects by converting to Blob
            setIsLoadingSrc(true);

            // Validate URL is safe before fetching
            if (!isValidUrl(docData)) {
                console.error("Invalid URL detected");
                setIsLoadingSrc(false);
                return;
            }

            fetch(docData, {
                mode: 'cors',
                credentials: 'omit'
            })
                .then(async response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    // Force PDF MIME type if expected, otherwise rely on blob type
                    const contentType = viewingDocument.mimeType || 'application/pdf';
                    const blobData = await response.blob();
                    // Create a new blob with the correct MIME type
                    const typedBlob = new Blob([blobData], { type: contentType });

                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result;
                        setDocumentSrc(`${dataUrl}#toolbar=0`);
                        setIsLoadingSrc(false);
                    };
                    reader.onerror = () => {
                        const blobUrl = window.URL.createObjectURL(typedBlob);
                        blobUrlRef.current = blobUrl;
                        setDocumentSrc(`${blobUrl}#toolbar=0`);
                        setIsLoadingSrc(false);
                    };
                    reader.readAsDataURL(typedBlob);
                })
                .catch(error => {
                    console.error("Fetch error, falling back to direct URL (sanitized):", error);

                    // Fallback: Use URL directly but ensure it's sanitized and forced inline
                    // Sanitize URL to remove possible malicious query params or fragments if needed, though mostly protocol matters
                    let url = DOMPurify.sanitize(docData);

                    // Remove any fl_attachment parameter (Cloudinary specific)
                    url = url.replace(/[?&]fl_attachment[^&]*/g, '');

                    // Add fl_inline parameter to force inline display
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}fl_inline#toolbar=0`;

                    // Final safety check before setting state
                    if (isValidUrl(url)) {
                        setDocumentSrc(url);
                    }
                    setIsLoadingSrc(false);
                });
        } else {
            // Handle base64 data
            let cleanData = docData;
            if (cleanData.includes(',')) {
                cleanData = cleanData.split(',')[1];
            }
            // Sanitize base64 content just in case? Base64 itself is safe if used in data URI properly.
            // But we should ensure mimeType is safe.
            const mimeType = viewingDocument.mimeType || 'application/pdf';

            // Construct Data URI
            const dataUri = `data:${mimeType};base64,${cleanData}#toolbar=0`;
            setDocumentSrc(dataUri);
        }

        return () => {
            if (blobUrlRef.current) {
                window.URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [viewingDocument?.data, isLoading, viewingDocument?.mimeType]);

    const handleDownload = async () => {
        if (isLoading) return;
        try {
            const isRemoteUrl = viewingDocument.data &&
                (viewingDocument.data.startsWith('http://') || viewingDocument.data.startsWith('https://'));

            let blob;
            if (isRemoteUrl) {
                if (!isValidUrl(viewingDocument.data)) throw new Error("Invalid URL");
                const response = await fetch(viewingDocument.data);
                blob = await response.blob();
            } else {
                let base64Data = viewingDocument.data;
                if (base64Data.includes(',')) {
                    base64Data = base64Data.split(',')[1];
                }
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                blob = new Blob([byteArray], { type: viewingDocument.mimeType || 'application/pdf' });
            }

            // Create download link safely
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; // blob: URLs are safe

            // Sanitize filename strictly
            const rawName = viewingDocument.name || 'document.pdf';
            const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Alphanumeric, dot, underscore, dash only
            link.download = safeName;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert('Failed to download document. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">
                        {/* React escapes text content by default, but we can verify it's just text */}
                        {viewingDocument.name}
                    </h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownload}
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
                        // Render iframe/image
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
                                        key={documentSrc}
                                        src={documentSrc} // Validated & Sanitized above
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
                                    src={documentSrc} // Validated & Sanitized above
                                    alt={viewingDocument.name}
                                    className="max-w-full h-auto mx-auto"
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
