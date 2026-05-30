'use client';

import { useEffect, useRef } from 'react';
import { openDocumentViewerFromPayload } from '@/utils/attachmentPreview';
import { useToast } from '@/hooks/use-toast';

/**
 * Legacy modal hook — opens documents in a new tab so the parent page is not blocked.
 * Existing call sites can keep using isOpen + viewingDocument without changes.
 */
export default function DocumentViewerModal({ isOpen, onClose, viewingDocument }) {
    const { toast } = useToast();
    const openedRef = useRef(false);

    useEffect(() => {
        openedRef.current = false;
    }, [viewingDocument?.name, viewingDocument?.storageRef, viewingDocument?.data]);

    useEffect(() => {
        if (!isOpen || !viewingDocument || viewingDocument.loading || openedRef.current) {
            return;
        }
        openedRef.current = true;
        const result = openDocumentViewerFromPayload(viewingDocument);
        if (!result.ok) {
            toast({
                variant: 'destructive',
                title: 'Cannot open document',
                description: result.error || 'Could not open document in a new tab.',
            });
        }
        onClose?.();
    }, [isOpen, viewingDocument, onClose, toast]);

    return null;
}
