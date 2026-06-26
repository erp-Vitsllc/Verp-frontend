'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { VEHICLE_PROFILE_ACTIVATION_SECTION_IDS, getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';

const normType = (t) => String(t || '').toLowerCase().trim();

function parseRegDescription(doc) {
    if (!doc?.description) return {};
    try {
        return JSON.parse(doc.description);
    } catch {
        return {};
    }
}

export function buildSectionRows(sectionId, asset) {
    const docs = asset?.documents || [];
    const registrationDoc = docs.find((d) => normType(d.type) === 'registration');
    const insuranceDoc = docs.find((d) => normType(d.type) === 'insurance');
    const warrantyDoc = docs.find((d) => normType(d.type) === 'warranty');
    const insMeta = insuranceDoc ? parseRegDescription(insuranceDoc) : {};

    switch (sectionId) {
        case 'basic':
            return [
                { label: 'Asset ID', value: asset?.assetId || '—' },
                { label: 'Brand', value: getVehicleBrandLabel(asset) || '—' },
                { label: 'Model', value: asset?.name || '—' },
                {
                    label: 'Plate',
                    value: `${asset?.plateEmirate || ''} ${asset?.plateNumber || ''}`.trim() || '—',
                },
                { label: 'Model year', value: asset?.modelYear ?? '—' },
            ];
        case 'registration':
            return [
                { label: 'Registration date', value: registrationDoc?.issueDate ? String(registrationDoc.issueDate).slice(0, 10) : '—' },
                { label: 'Expiry', value: registrationDoc?.expiryDate ? String(registrationDoc.expiryDate).slice(0, 10) : '—' },
                {
                    label: 'Registration value',
                    value: (() => {
                        const m = parseRegDescription(registrationDoc);
                        return m.fee != null ? `AED ${Number(m.fee).toLocaleString()}` : '—';
                    })(),
                },
                { label: 'Primary card on file', value: registrationDoc?.attachment ? 'Yes' : 'No' },
            ];
        case 'insurance':
            return [
                { label: 'Insurer', value: insMeta.company || insuranceDoc?.issueAuthority || '—' },
                { label: 'Policy', value: insMeta.policy || '—' },
                { label: 'Start', value: insuranceDoc?.issueDate ? String(insuranceDoc.issueDate).slice(0, 10) : '—' },
                { label: 'End', value: insuranceDoc?.expiryDate ? String(insuranceDoc.expiryDate).slice(0, 10) : '—' },
            ];
        case 'profile_picture':
            return [
                {
                    label: 'Profile picture',
                    value:
                        asset?.imagePreview || asset?.photo || asset?.images?.[0]?.url ? 'Uploaded' : 'Missing',
                },
            ];
        case 'warranty':
            return [
                { label: 'Start', value: warrantyDoc?.issueDate ? String(warrantyDoc.issueDate).slice(0, 10) : '—' },
                { label: 'End', value: warrantyDoc?.expiryDate ? String(warrantyDoc.expiryDate).slice(0, 10) : '—' },
                { label: 'Attachment', value: warrantyDoc?.attachment ? 'Yes' : 'No' },
            ];
        case 'documents': {
            const n = docs.length;
            const types = [...new Set(docs.map((d) => normType(d.type)).filter(Boolean))];
            return [
                { label: 'Total document rows', value: String(n) },
                { label: 'Types present', value: types.length ? types.join(', ') : '—' },
            ];
        }
        default:
            return [];
    }
}

export const VEHICLE_ACTIVATION_SECTION_LABELS = {
    basic: 'Basic details',
    registration: 'Registration card',
    insurance: 'Insurance card',
    profile_picture: 'Profile picture',
};

export function sectionGroups() {
    return VEHICLE_PROFILE_ACTIVATION_SECTION_IDS.map((id) => ({
        id,
        label: VEHICLE_ACTIVATION_SECTION_LABELS[id] || id,
    }));
}

export function RowTable({ rows }) {
    return (
        <div className="rounded-lg border border-slate-200 overflow-hidden text-sm">
            {rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 px-3 py-2 border-b border-slate-100 last:border-0 bg-white">
                    <span className="text-slate-500 shrink-0">{r.label}</span>
                    <span className="font-semibold text-slate-800 text-right break-words">{r.value}</span>
                </div>
            ))}
        </div>
    );
}

export default function VehicleActivationSubmitModal({
    isOpen,
    onClose,
    asset,
    assetMongoId,
    onSuccess,
}) {
    const { toast } = useToast();
    const groups = sectionGroups();
    const [description, setDescription] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setDescription('');
    }, [isOpen]);

    if (!isOpen || !asset) return null;

    const submit = async () => {
        setSending(true);
        try {
            await axiosInstance.post(`/AssetItem/${assetMongoId}/submit-vehicle-profile-activation`, {
                description: description.trim(),
                includedSections: [...VEHICLE_PROFILE_ACTIVATION_SECTION_IDS],
            });
            toast({
                title: 'Submitted for activation',
                description: 'HR has been emailed and will see this request in their vehicle notifications.',
            });
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Submit failed',
                description: err.response?.data?.message || 'Could not submit for activation.',
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">Submit for activation</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        This sends the vehicle profile to the flowchart <strong>HR</strong> assignee for approval.
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-xs text-gray-600 leading-snug">
                        The following mandatory items will be included in this request:
                    </p>
                    <ul className="text-sm text-gray-800 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
                        {groups.map((group) => (
                            <li key={group.id} className="flex items-center gap-2">
                                <span className="text-emerald-600 font-bold">✓</span>
                                {group.label}
                            </li>
                        ))}
                    </ul>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Note for HR (optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none"
                            placeholder="Add any context for HR…"
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (!sending) onClose();
                        }}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={sending}
                        className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? 'Submitting…' : 'Submit for activation'}
                    </button>
                </div>
            </div>
        </div>
    );
}
