'use client';

import { useMemo, useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';
import { buildVehicleServiceAttachmentRows } from '../utils/vehicleServiceAttachments';

const { card, header } = VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

const viewBtn =
    'inline-flex items-center justify-center gap-1.5 min-w-[64px] px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-45 disabled:cursor-not-allowed';

export default function VehicleServiceAttachmentsPanel({ service, className = '' }) {
    const { toast } = useToast();
    const [viewingId, setViewingId] = useState('');
    const rows = useMemo(() => buildVehicleServiceAttachmentRows(service), [service]);

    const handleView = async (row) => {
        if (!row?.url || viewingId) return;
        setViewingId(row.id);
        try {
            const result = await openAttachmentInNewTab(row.url, {
                name: row.name || `${row.label || 'Attachment'}.pdf`,
                mimeType: 'application/pdf',
            });
            if (!result.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot open file',
                    description: result.error || 'Attachment is unavailable.',
                });
            }
        } catch {
            toast({
                variant: 'destructive',
                title: 'Cannot open file',
                description: 'Attachment is unavailable.',
            });
        } finally {
            setViewingId('');
        }
    };

    return (
        <div
            className={`flex w-full flex-col ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <div
                className={`flex items-center gap-3 border-b border-gray-100 shrink-0 ${header.paddingBottomClass} ${header.marginBottomClass}`}
            >
                <div className="rounded-xl bg-emerald-50 p-3.5 text-emerald-700">
                    <Paperclip size={30} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-gray-800">Attachments</h4>
                    <p className="mt-1 text-sm text-gray-500">Documents added on this service</p>
                </div>
            </div>

            {!rows.length ? (
                <p className="py-6 text-center text-sm text-gray-500">No attachments added yet.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {rows.map((row) => (
                        <li key={row.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                                <FileText size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    {row.label}
                                </p>
                                <p className="truncate text-sm font-semibold text-gray-800">
                                    {row.name || row.label}
                                </p>
                            </div>
                            {row.url ? (
                                <button
                                    type="button"
                                    className={viewBtn}
                                    disabled={!!viewingId}
                                    onClick={() => void handleView(row)}
                                >
                                    {viewingId === row.id ? 'Opening…' : 'View'}
                                </button>
                            ) : (
                                <span className="text-xs font-medium text-gray-400">On file</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
