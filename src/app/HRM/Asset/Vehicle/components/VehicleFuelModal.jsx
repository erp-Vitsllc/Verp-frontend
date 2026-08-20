'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Fuel, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MonthPicker } from '@/components/ui/date-picker';
import { ERP_ATTACHMENT_ACCEPT, ERP_ATTACHMENT_HINT, validateErpUploadFile } from '@/utils/uploadFileTypes';
import axiosInstance from '@/utils/axios';

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function vehicleLabel(vehicle) {
    if (!vehicle) return '';
    return [vehicle.plate, vehicle.name].filter(Boolean).join(' — ') || vehicle.assetId || '';
}

function positiveLimit(value) {
    const n = Number(String(value ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function petrolCardLimit(source) {
    const docs = Array.isArray(source?.documents) ? source.documents : [];
    const petrol = docs.find((d) => String(d.type || '').toLowerCase() === 'petrol');
    if (!petrol?.description) return null;
    try {
        const parsed =
            typeof petrol.description === 'string' ? JSON.parse(petrol.description) : petrol.description;
        return positiveLimit(parsed?.limit);
    } catch {
        return null;
    }
}

function defaultMonthlyLimit(asset, vehicle) {
    const n =
        positiveLimit(vehicle?.fuelMonthlyLimit) ||
        positiveLimit(asset?.fuelMonthlyLimit) ||
        petrolCardLimit(vehicle) ||
        petrolCardLimit(asset);
    return n != null ? String(n) : '';
}

function billPositiveLimit(bill) {
    const n = positiveLimit(bill?.monthlyLimit);
    return n != null ? String(n) : '';
}

function billIdOf(bill) {
    return bill?._id ? String(bill._id) : '';
}

function vehicleIdOf(bill) {
    const raw = bill?.vehicleId;
    if (!raw) return '';
    if (typeof raw === 'object') return String(raw._id || raw.id || '');
    return String(raw);
}

export default function VehicleFuelModal({
    isOpen,
    onClose,
    onSaved,
    asset,
    vehicles = [],
    existingBill = null,
    knownBills = [],
    canManage = false,
    lockVehicle = false,
    variant = 'modal',
}) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const [vehicleId, setVehicleId] = useState('');
    const [monthKey, setMonthKey] = useState(currentMonthKey());
    const [amount, setAmount] = useState('');
    const [monthlyLimit, setMonthlyLimit] = useState('');
    const [fileName, setFileName] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [matchedBill, setMatchedBill] = useState(null);
    const [errors, setErrors] = useState({});

    const activeBill = existingBill || matchedBill;
    const isUpdate = Boolean(billIdOf(activeBill));
    const monthClosed = activeBill?.status === 'closed';
    const vehicleLocked = Boolean(lockVehicle || asset?._id || asset?.id);
    const selectedVehicle = useMemo(
        () => vehicles.find((v) => String(v._id) === String(vehicleId)) || null,
        [vehicles, vehicleId],
    );
    const lockedVehicleName = useMemo(() => {
        if (!vehicleLocked) return '';
        if (selectedVehicle) return vehicleLabel(selectedVehicle);
        const plate = [asset?.plateEmirate, asset?.plateNumber].filter(Boolean).join(' ').trim();
        if (plate && asset?.name) return `${plate} — ${asset.name}`;
        return plate || asset?.name || asset?.assetId || '';
    }, [vehicleLocked, selectedVehicle, asset]);
    const lockedOwnerName = useMemo(() => {
        if (selectedVehicle?.owner) return selectedVehicle.owner;
        if (asset?.assignedToType === 'Company') return asset?.assignedCompany?.name || 'Company';
        const name = `${asset?.assignedTo?.firstName || ''} ${asset?.assignedTo?.lastName || ''}`.trim();
        return name || '';
    }, [selectedVehicle, asset]);

    const formSession = useRef(0);

    useEffect(() => {
        if (!isOpen) return;
        formSession.current += 1;
        const defaultVehicleId = vehicleLocked
            ? asset?._id || asset?.id || vehicleIdOf(existingBill)
            : vehicleIdOf(existingBill) || asset?._id || asset?.id || '';
        setVehicleId(String(defaultVehicleId || ''));
        setMonthKey(existingBill?.monthKey || currentMonthKey());
        setAmount(existingBill?.amountUsed != null ? String(existingBill.amountUsed) : '');
        setMonthlyLimit(billPositiveLimit(existingBill) || '');
        setFileName(existingBill?.entries?.find((e) => e.hasAttachment)?.attachmentName || '');
        setAttachment(null);
        setMatchedBill(existingBill?._id ? existingBill : null);
        setErrors({});
        setConfirmClose(false);
    }, [isOpen, existingBill]);

    useEffect(() => {
        if (!isOpen || vehicleId || existingBill?._id) return;
        const first = vehicles[0]?._id;
        if (first) setVehicleId(String(first));
    }, [isOpen, vehicleId, vehicles, existingBill]);

    useEffect(() => {
        if (!isOpen || existingBill?._id) return;
        const next = defaultMonthlyLimit(asset, selectedVehicle);
        if (next) setMonthlyLimit(next);
    }, [isOpen, existingBill, selectedVehicle, asset]);

    useEffect(() => {
        if (!isOpen || existingBill?._id || !vehicleId || !monthKey) return;
        const session = formSession.current;
        const local = (knownBills || []).find(
            (bill) =>
                Boolean(bill?._id) &&
                !bill?.noFuel &&
                vehicleIdOf(bill) === String(vehicleId) &&
                String(bill.monthKey) === String(monthKey),
        );
        const vehicleDefault = defaultMonthlyLimit(asset, selectedVehicle);
        if (local) {
            setMatchedBill(local);
            setAmount(local.amountUsed != null ? String(local.amountUsed) : '');
            setMonthlyLimit(billPositiveLimit(local) || vehicleDefault);
            setFileName(local.entries?.find((e) => e.hasAttachment)?.attachmentName || '');
            return;
        }

        let cancelled = false;
        axiosInstance
            .get('/VehicleFuel/lookup', { params: { vehicleId, monthKey }, skipToast: true })
            .then((res) => {
                if (cancelled || session !== formSession.current) return;
                const bill = res.data?.data || null;
                setMatchedBill(bill);
                if (bill) {
                    setAmount(bill.amountUsed != null ? String(bill.amountUsed) : '');
                    setMonthlyLimit(billPositiveLimit(bill) || vehicleDefault);
                    setFileName(bill.entries?.find((e) => e.hasAttachment)?.attachmentName || '');
                    return;
                }
                if (vehicleDefault) setMonthlyLimit(vehicleDefault);
            })
            .catch(() => {
                if (!cancelled && session === formSession.current && vehicleDefault) {
                    setMatchedBill(null);
                    setMonthlyLimit(vehicleDefault);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, existingBill, vehicleId, monthKey, knownBills, asset, selectedVehicle]);

    if (!isOpen) return null;

    const validate = () => {
        const next = {};
        if (!vehicleId) next.vehicleId = 'Select a vehicle.';
        if (!monthKey) next.monthKey = 'Select a month.';
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) next.amount = 'Enter a valid amount.';
        const vehicleLimit = Number(defaultMonthlyLimit(asset, selectedVehicle));
        const limit = Number(monthlyLimit);
        if (
            !isUpdate &&
            (!Number.isFinite(limit) || limit <= 0) &&
            (!Number.isFinite(vehicleLimit) || vehicleLimit <= 0)
        ) {
            next.monthlyLimit = 'Set a monthly limit on the vehicle, or enter one here.';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const check = validateErpUploadFile(file);
        if (!check.ok) {
            toast({ variant: 'destructive', title: 'Invalid file', description: check.message });
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const data = String(reader.result || '').split(',')[1] || '';
            setAttachment({
                name: file.name,
                mimeType: file.type || (check.kind === 'jpeg' ? 'image/jpeg' : 'application/pdf'),
                data,
            });
            setFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!canManage || monthClosed || !validate()) return;
        setSaving(true);
        try {
            const payload = {
                vehicleId,
                monthKey,
                amount: Number(amount),
                ...(isUpdate ? {} : { monthlyLimit: Number(monthlyLimit) || Number(defaultMonthlyLimit(asset, selectedVehicle)) || undefined }),
                ...(attachment ? { attachment } : {}),
            };
            const res = isUpdate
                ? await axiosInstance.put(`/VehicleFuel/${billIdOf(activeBill)}`, payload)
                : await axiosInstance.post('/VehicleFuel', payload);
            toast({
                title: isUpdate ? 'Updated' : 'Created',
                description: res.data?.message || (isUpdate ? 'Fuel bill updated.' : 'Fuel bill created.'),
            });
            onSaved?.(res.data?.data || null);
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save',
                description: error.response?.data?.message || 'Failed to save fuel.',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCloseBill = async () => {
        if (!canManage || !isUpdate) return;
        setClosing(true);
        try {
            const res = await axiosInstance.post(`/VehicleFuel/${billIdOf(activeBill)}/close`);
            toast({ title: 'Bill closed', description: res.data?.message || 'This month’s fuel bill is closed.' });
            setConfirmClose(false);
            onSaved?.(res.data?.data || null);
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not close',
                description: error.response?.data?.message || 'Failed to close the fuel bill.',
            });
        } finally {
            setClosing(false);
        }
    };

    const isInline = variant === 'inline';

    return (
        <div
            className={
                isInline
                    ? ''
                    : 'fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'
            }
        >
            <div
                className={
                    isInline
                        ? 'px-4 sm:px-6 py-4 bg-slate-50/70 border-b border-slate-100'
                        : 'bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100'
                }
            >
                {isInline ? null : (
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/40">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                            <Fuel size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">
                                {isUpdate ? 'Update Fuel' : 'Add Fuel'}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {isUpdate ? 'Existing month — monthly limit locked' : 'Create this month’s petrol bill'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white"
                    >
                        <X size={20} />
                    </button>
                </div>
                )}

                <div className={isInline ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'px-6 py-5 space-y-4'}>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Vehicle
                        </label>
                        {vehicleLocked ? (
                            <>
                                <div className="w-full min-h-11 px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-800 font-semibold">
                                    {lockedVehicleName || '—'}
                                </div>
                                {lockedOwnerName ? (
                                    <p className="text-[11px] text-slate-400 mt-1">Owner: {lockedOwnerName}</p>
                                ) : null}
                            </>
                        ) : (
                            <>
                                <select
                                    value={vehicleId}
                                    onChange={(e) => setVehicleId(e.target.value)}
                                    disabled={Boolean(existingBill?._id)}
                                    className={`w-full h-11 px-4 rounded-xl border bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 ${errors.vehicleId ? 'border-red-400' : 'border-slate-200'}`}
                                >
                                    <option value="">Select vehicle</option>
                                    {vehicles.map((v) => (
                                        <option key={v._id} value={v._id}>
                                            {vehicleLabel(v)}
                                        </option>
                                    ))}
                                </select>
                                {selectedVehicle?.owner ? (
                                    <p className="text-[11px] text-slate-400 mt-1">Owner: {selectedVehicle.owner}</p>
                                ) : null}
                                {errors.vehicleId && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.vehicleId}</p>}
                            </>
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Select the month
                        </label>
                        <MonthPicker
                            value={monthKey}
                            onChange={setMonthKey}
                            disabled={Boolean(existingBill?._id)}
                            className={errors.monthKey ? 'border-red-400' : ''}
                        />
                        {errors.monthKey && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.monthKey}</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Monthly limit
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={monthlyLimit}
                            onChange={(e) => setMonthlyLimit(e.target.value)}
                            disabled={isUpdate || Boolean(defaultMonthlyLimit(asset, selectedVehicle))}
                            placeholder="0.00"
                            className={`w-full h-11 px-4 rounded-xl border bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:text-slate-400 disabled:cursor-not-allowed ${errors.monthlyLimit ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        {isUpdate ? (
                            <p className="text-[11px] text-slate-400 mt-1">Monthly limit cannot be changed after create.</p>
                        ) : defaultMonthlyLimit(asset, selectedVehicle) ? (
                            <p className="text-[11px] text-slate-400 mt-1">Filled automatically from this vehicle.</p>
                        ) : null}
                        {errors.monthlyLimit && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.monthlyLimit}</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Enter the amount
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className={`w-full h-11 px-4 rounded-xl border bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 ${errors.amount ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        {errors.amount && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.amount}</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Attachment <span className="text-slate-300 normal-case tracking-normal">(optional)</span>
                        </label>
                        <label className="flex items-center justify-between w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                            <span className="text-sm text-slate-600 truncate">{fileName || ERP_ATTACHMENT_HINT}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Browse</span>
                            <input type="file" accept={ERP_ATTACHMENT_ACCEPT} className="hidden" onChange={handleFile} />
                        </label>
                    </div>
                </div>

                <div
                    className={
                        isInline
                            ? 'mt-3 flex items-center justify-end gap-2'
                            : 'px-6 py-4 border-t border-slate-50 flex items-center justify-between gap-3 bg-slate-50/30'
                    }
                >
                    {isInline ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white"
                        >
                            Cancel
                        </button>
                    ) : (
                    <button
                        type="button"
                        disabled={!canManage || !isUpdate || closing || monthClosed}
                        onClick={() => setConfirmClose(true)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white disabled:opacity-40"
                    >
                        Close
                    </button>
                    )}
                    <button
                        type="button"
                        disabled={!canManage || saving || monthClosed}
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : isUpdate ? 'Update' : 'Create'}
                    </button>
                </div>
            </div>

            {confirmClose && !isInline && (
                <div className="absolute inset-0 z-[10] flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Close bill?</h3>
                        <p className="text-sm text-slate-500 mt-2">
                            Do you want to close this month’s fuel bill? Once closed, fuel cannot be added again for the selected month.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmClose(false)}
                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={closing}
                                onClick={handleCloseBill}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest"
                            >
                                {closing ? 'Closing…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
