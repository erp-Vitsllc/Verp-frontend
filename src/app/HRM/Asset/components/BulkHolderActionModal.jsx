'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Select from 'react-select';
import { X, Undo2, ArrowRightLeft, ListChecks, Package, CalendarClock, PackageX, Building2, User } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * List-page bulk actions: pick holder (employee or company), then select one or more Assigned assets.
 * mode: 'return' — bulk return (assignee pending path or AC immediate per asset)
 * mode: 'transfer' — Leave / End of Services (same API as TransferAssetModal)
 */
export default function BulkHolderActionModal({ isOpen, mode, onClose, onSuccess }) {
    const { toast } = useToast();

    const [holderType, setHolderType] = useState('employee'); // 'employee' | 'company'
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [allAssigned, setAllAssigned] = useState([]);

    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);

    const [currentEmpId, setCurrentEmpId] = useState(null);
    const [isElevated, setIsElevated] = useState(false);

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Transfer-only
    const [actionOption, setActionOption] = useState('Leave');
    const [leaveDuration, setLeaveDuration] = useState('');

    const resetForm = useCallback(() => {
        setHolderType('employee');
        setSelectedEmployeeId(null);
        setSelectedCompanyId(null);
        setSelectedAssetIds([]);
        setActionOption('Leave');
        setLeaveDuration('');
        setConfirmOpen(false);
    }, []);

    const detectElevated = useCallback(async (employeeId) => {
        try {
            const user = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('user') || '{}' : '{}');
            if (user?.isAdmin === true || user?.role === 'Admin' || user?.role === 'ROOT') {
                setIsElevated(true);
                return true;
            }
            if (employeeId) {
                const ctrlRes = await axiosInstance
                    .get(`/AssetItem/unassigned/controller/${encodeURIComponent(employeeId)}`, { skipToast: true })
                    .catch(() => null);
                if (ctrlRes?.status === 200) {
                    setIsElevated(true);
                    return true;
                }
            }
        } catch {
            /* ignore */
        }
        setIsElevated(false);
        return false;
    }, []);

    useEffect(() => {
        if (!isOpen || !mode) return;

        resetForm();
        setLoading(true);

        (async () => {
            try {
                const [empRes, compRes, assignedRes, meRes] = await Promise.all([
                    axiosInstance.get('/employee'),
                    axiosInstance.get('/company'),
                    axiosInstance.get('/AssetItem/assigned/all'),
                    axiosInstance.get('/Employee/me').catch(() => null),
                ]);

                setEmployees(empRes.data?.employees || []);
                setCompanies(compRes.data?.companies || compRes.data || []);
                const list = Array.isArray(assignedRes.data) ? assignedRes.data : [];
                setAllAssigned(list);

                const me = meRes?.data;
                const oid = me?._id?.toString() || me?.id?.toString() || null;
                setCurrentEmpId(oid || null);

                const elevated = await detectElevated(me?.employeeId);

                if (oid && !elevated) {
                    setSelectedEmployeeId(oid);
                    setHolderType('employee');
                }
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load data for bulk action.' });
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, mode, resetForm, detectElevated, toast]);

    const eligibleAssets = useMemo(() => {
        const noPending = (a) => !a.pendingAction;
        const isAssigned = (a) => String(a.status || '') === 'Assigned';

        if (holderType === 'employee') {
            if (!selectedEmployeeId) return [];
            return allAssigned.filter((a) => {
                if (!isAssigned(a) || !noPending(a)) return false;
                const at = a.assignedTo?._id || a.assignedTo;
                return at && String(at) === String(selectedEmployeeId);
            });
        }

        if (!selectedCompanyId) return [];
        return allAssigned.filter((a) => {
            if (!isAssigned(a) || !noPending(a)) return false;
            if (String(a.assignedToType || '').toLowerCase() !== 'company') return false;
            const c = a.assignedCompany?._id || a.assignedCompany;
            return c && String(c) === String(selectedCompanyId);
        });
    }, [allAssigned, holderType, selectedEmployeeId, selectedCompanyId]);

    useEffect(() => {
        setSelectedAssetIds((prev) => prev.filter((id) => eligibleAssets.some((a) => String(a._id) === String(id))));
    }, [eligibleAssets]);

    const employeeOptions = useMemo(() => {
        const opts = (employees || []).map((e) => ({
            value: e._id,
            label: `${e.firstName || ''} ${e.lastName || ''} (${e.employeeId || ''})`.trim(),
        }));
        if (!isElevated && currentEmpId) {
            return opts.filter((o) => String(o.value) === String(currentEmpId));
        }
        return opts;
    }, [employees, isElevated, currentEmpId]);

    const companyOptions = useMemo(() => {
        return (companies || []).map((c) => ({
            value: c._id,
            label: c.name || c.companyId || String(c._id),
        }));
    }, [companies]);

    const toggleAsset = (id) => {
        const sid = String(id);
        setSelectedAssetIds((prev) => (prev.some((x) => String(x) === sid) ? prev.filter((x) => String(x) !== sid) : [...prev, id]));
    };

    const selectAllEligible = () => {
        setSelectedAssetIds(eligibleAssets.map((a) => a._id));
    };

    const handleSubmitReturn = async () => {
        if (selectedAssetIds.length === 0) {
            toast({ variant: 'destructive', title: 'Select assets', description: 'Pick at least one asset.' });
            return;
        }

        const ids = selectedAssetIds.map((x) => String(x));
        const primary = ids[0];

        const assigneeSelf =
            holderType === 'employee' &&
            selectedEmployeeId &&
            currentEmpId &&
            String(selectedEmployeeId) === String(currentEmpId);

        setSubmitting(true);
        try {
            if (assigneeSelf) {
                if (ids.length > 1) {
                    await axiosInstance.put(`/AssetItem/${primary}/return`, { bulkAssetIds: ids });
                } else {
                    await axiosInstance.put(`/AssetItem/${primary}/return`, {});
                }
                toast({
                    title: 'Success',
                    description:
                        ids.length > 1
                            ? 'Return request sent to Asset Controller for the selected assets.'
                            : 'Return request sent to Asset Controller.',
                });
            } else {
                for (const id of ids) {
                    await axiosInstance.put(`/AssetItem/${id}/return`, {});
                }
                toast({
                    title: 'Success',
                    description: `Return processed for ${ids.length} asset(s).`,
                });
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Bulk return failed.',
            });
        } finally {
            setSubmitting(false);
            setConfirmOpen(false);
        }
    };

    const handleSubmitTransfer = async () => {
        if (selectedAssetIds.length === 0) {
            toast({ variant: 'destructive', title: 'Select assets', description: 'Pick at least one asset.' });
            return;
        }

        if (actionOption === 'Leave') {
            const d = parseInt(leaveDuration, 10);
            if (!Number.isInteger(d) || d < 1 || d > 30) {
                toast({ variant: 'destructive', title: 'Duration', description: 'Enter leave duration between 1 and 30 days.' });
                return;
            }
        }

        const ids = selectedAssetIds.map((x) => String(x));
        const reasonText = actionOption === 'Leave' ? `Leave duration: ${leaveDuration} days` : 'End of Services return requested';
        const payloadBase = {
            actionType: actionOption,
            reason: reasonText,
        };
        if (actionOption === 'Leave') {
            const d = parseInt(leaveDuration, 10);
            payloadBase.duration = d;
            payloadBase.leaveDuration = d;
        }

        setSubmitting(true);
        try {
            if (ids.length > 1) {
                await axiosInstance.put('/AssetItem/bulk/request-action', {
                    assetIds: ids,
                    ...payloadBase,
                });
            } else {
                await axiosInstance.put(`/AssetItem/${ids[0]}/request-action`, payloadBase);
            }

            toast({
                title: 'Success',
                description: `${actionOption} request sent for ${ids.length} asset(s).`,
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Request failed.',
            });
        } finally {
            setSubmitting(false);
            setConfirmOpen(false);
        }
    };

    if (!isOpen || !mode) return null;

    const title = mode === 'return' ? 'Bulk return' : 'Bulk transfer to store';
    const Icon = mode === 'return' ? Undo2 : ArrowRightLeft;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100">
                            <Icon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Choose holder, then select assets
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading ? (
                        <p className="text-sm text-center text-gray-500 py-10">Loading…</p>
                    ) : (
                        <>
                            <div className="flex rounded-2xl border border-slate-200 bg-slate-50/80 p-1 gap-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHolderType('employee');
                                        setSelectedCompanyId(null);
                                        if (!isElevated && currentEmpId) setSelectedEmployeeId(currentEmpId);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                                        holderType === 'employee' ? 'bg-white shadow text-amber-800' : 'text-slate-500'
                                    }`}
                                >
                                    <User size={16} /> Employee
                                </button>
                                <button
                                    type="button"
                                    disabled={!isElevated}
                                    onClick={() => {
                                        setHolderType('company');
                                        setSelectedEmployeeId(null);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                                        holderType === 'company' ? 'bg-white shadow text-amber-800' : 'text-slate-500'
                                    } ${!isElevated ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    title={!isElevated ? 'Only Asset Controller / Admin can select company holder' : ''}
                                >
                                    <Building2 size={16} /> Company
                                </button>
                            </div>

                            {holderType === 'employee' ? (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Assigned employee</label>
                                    <Select
                                        classNamePrefix="rs"
                                        placeholder="Select employee…"
                                        options={employeeOptions}
                                        value={employeeOptions.find((o) => String(o.value) === String(selectedEmployeeId)) || null}
                                        onChange={(opt) => setSelectedEmployeeId(opt ? opt.value : null)}
                                        isClearable={isElevated}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Company allocation</label>
                                    <Select
                                        classNamePrefix="rs"
                                        placeholder="Select company…"
                                        options={companyOptions}
                                        value={companyOptions.find((o) => String(o.value) === String(selectedCompanyId)) || null}
                                        onChange={(opt) => setSelectedCompanyId(opt ? opt.value : null)}
                                        isClearable
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <ListChecks size={14} /> Assets ({eligibleAssets.length})
                                    </label>
                                    {eligibleAssets.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={selectAllEligible}
                                            className="text-[10px] font-bold uppercase text-amber-700 hover:underline"
                                        >
                                            Select all
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[200px] overflow-y-auto border rounded-2xl p-2 space-y-1 bg-slate-50/50">
                                    {eligibleAssets.length === 0 ? (
                                        <p className="text-xs text-center text-slate-400 py-6 font-semibold uppercase">
                                            No eligible Assigned assets for this holder
                                        </p>
                                    ) : (
                                        eligibleAssets.map((a) => {
                                            const id = a._id;
                                            const checked = selectedAssetIds.some((x) => String(x) === String(id));
                                            return (
                                                <label
                                                    key={String(id)}
                                                    className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl cursor-pointer hover:border-amber-200"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-amber-600"
                                                        checked={checked}
                                                        onChange={() => toggleAsset(id)}
                                                    />
                                                    <Package size={18} className="text-slate-400 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{a.name}</p>
                                                        <p className="text-[10px] font-mono text-slate-400">{a.assetId}</p>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {mode === 'transfer' && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setActionOption('Leave')}
                                            className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${
                                                actionOption === 'Leave'
                                                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                                                    : 'border-slate-100 bg-white text-slate-400'
                                            }`}
                                        >
                                            <CalendarClock size={26} className="mb-1" />
                                            <span className="text-[11px] font-bold uppercase">Leave</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActionOption('End of Services')}
                                            className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${
                                                actionOption === 'End of Services'
                                                    ? 'border-rose-400 bg-rose-50 text-rose-800'
                                                    : 'border-slate-100 bg-white text-slate-400'
                                            }`}
                                        >
                                            <PackageX size={26} className="mb-1" />
                                            <span className="text-[11px] font-bold uppercase">End of Services</span>
                                        </button>
                                    </div>
                                    {actionOption === 'Leave' && (
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Duration (days)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={leaveDuration}
                                                onChange={(e) => setLeaveDuration(e.target.value)}
                                                className="w-full px-4 py-3 border border-amber-200 rounded-xl text-sm font-bold"
                                                placeholder="1–30"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="p-5 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-600 bg-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting || loading || selectedAssetIds.length === 0}
                        onClick={() => setConfirmOpen(true)}
                        className="flex-[2] py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 disabled:opacity-50"
                    >
                        {mode === 'return' ? 'Submit bulk return' : 'Submit bulk transfer'}
                    </button>
                </div>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Confirm</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-600">
                            {mode === 'return'
                                ? `Process return for ${selectedAssetIds.length} asset(s) for the selected holder?`
                                : `Send ${actionOption} for ${selectedAssetIds.length} asset(s) to the Asset Controller workflow?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={(e) => {
                                e.preventDefault();
                                if (mode === 'return') handleSubmitReturn();
                                else handleSubmitTransfer();
                            }}
                        >
                            {submitting ? 'Working…' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
