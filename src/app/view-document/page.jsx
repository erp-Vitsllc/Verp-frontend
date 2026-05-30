'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DocumentViewerContent from '@/components/DocumentViewerContent';
import { readDocumentViewerSessionPayload } from '@/utils/attachmentPreview';

function ViewDocumentInner() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const [payload, setPayload] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) {
            setError('No document specified.');
            return;
        }

        const loadPayload = () => readDocumentViewerSessionPayload(id);

        let data = loadPayload();
        if (data) {
            setPayload(data);
            return;
        }

        // Brief retry — new tab can hydrate before parent localStorage write finishes in edge cases
        const timer = window.setTimeout(() => {
            data = loadPayload();
            if (data) {
                setPayload(data);
            } else {
                setError('Document session expired or not found. Open the file again from the app.');
            }
        }, 150);

        return () => window.clearTimeout(timer);
    }, [id]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
                <div className="max-w-md text-center bg-white rounded-xl shadow p-8">
                    <h1 className="text-lg font-bold text-slate-800 mb-2">Cannot open document</h1>
                    <p className="text-slate-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (!payload) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <DocumentViewerContent
            viewingDocument={payload}
            onClose={() => window.close()}
            showClose
        />
    );
}

export default function ViewDocumentPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-100">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            }
        >
            <ViewDocumentInner />
        </Suspense>
    );
}
