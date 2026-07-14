'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, CheckSquare, Square } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const ASSET_LIST_EXPORT_FIELDS = [
    { key: 'assignedTo', label: 'Assigned to' },
    { key: 'assetType', label: 'Asset Type' },
    { key: 'category', label: 'Category' },
    { key: 'assetName', label: 'Asset Name' },
    { key: 'accessories', label: 'Accessories' },
    { key: 'assetId', label: 'Asset ID' },
    { key: 'qty', label: 'QTY' },
    { key: 'value', label: 'Value (AED)' },
];

const DEFAULT_SELECTED = Object.fromEntries(ASSET_LIST_EXPORT_FIELDS.map((f) => [f.key, true]));

/**
 * Two-step export dialog:
 * 1) Choose PDF or Excel
 * 2) Pick columns (multi-select) → Download
 */
export default function AssetListExportDialog({
    open,
    onOpenChange,
    downloading = false,
    showGroupByOwner = false,
    onDownload,
}) {
    const [step, setStep] = useState(1);
    const [format, setFormat] = useState('pdf');
    const [selected, setSelected] = useState(() => ({ ...DEFAULT_SELECTED }));
    const [groupByOwner, setGroupByOwner] = useState(false);

    useEffect(() => {
        if (!open) return;
        setStep(1);
        setFormat('pdf');
        setSelected({ ...DEFAULT_SELECTED });
        setGroupByOwner(false);
    }, [open]);

    const selectedKeys = useMemo(
        () => ASSET_LIST_EXPORT_FIELDS.filter((f) => selected[f.key]).map((f) => f.key),
        [selected],
    );

    const allChecked = selectedKeys.length === ASSET_LIST_EXPORT_FIELDS.length;
    const noneChecked = selectedKeys.length === 0;

    const toggleField = (key) => {
        setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const selectAll = () => setSelected({ ...DEFAULT_SELECTED });
    const selectNone = () =>
        setSelected(Object.fromEntries(ASSET_LIST_EXPORT_FIELDS.map((f) => [f.key, false])));

    const handleClose = (nextOpen) => {
        if (downloading) return;
        onOpenChange?.(nextOpen);
    };

    const handleDownload = () => {
        if (noneChecked || downloading) return;
        onDownload?.({
            format,
            columns: selectedKeys,
            groupByOwner: format === 'pdf' && showGroupByOwner ? groupByOwner : false,
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={handleClose}>
            <AlertDialogContent className="bg-white rounded-[24px] max-w-lg border border-slate-200 shadow-2xl p-0 overflow-hidden">
                <AlertDialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100 bg-slate-50/80">
                    <AlertDialogTitle className="text-xl font-bold text-slate-800">
                        Download Asset List
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-gray-500 text-left">
                        {step === 1
                            ? 'Choose the file format for your download.'
                            : 'Select the columns to include in the document. You can pick more than one.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="px-6 py-5">
                    {step === 1 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormat('pdf')}
                                className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 transition-colors ${
                                    format === 'pdf'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <FileText size={28} className={format === 'pdf' ? 'text-indigo-600' : 'text-slate-400'} />
                                <span className="text-sm font-bold uppercase tracking-wide">PDF</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat('excel')}
                                className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 transition-colors ${
                                    format === 'excel'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <FileSpreadsheet
                                    size={28}
                                    className={format === 'excel' ? 'text-indigo-600' : 'text-slate-400'}
                                />
                                <span className="text-sm font-bold uppercase tracking-wide">Excel</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Format: {format === 'pdf' ? 'PDF' : 'Excel'}
                                </p>
                                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        disabled={allChecked}
                                        className="text-indigo-600 hover:underline disabled:opacity-40"
                                    >
                                        Check all
                                    </button>
                                    <button
                                        type="button"
                                        onClick={selectNone}
                                        disabled={noneChecked}
                                        className="text-slate-500 hover:underline disabled:opacity-40"
                                    >
                                        Uncheck all
                                    </button>
                                </div>
                            </div>

                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {ASSET_LIST_EXPORT_FIELDS.map((field) => {
                                    const isOn = !!selected[field.key];
                                    return (
                                        <li key={field.key}>
                                            <label
                                                htmlFor={`asset-export-col-${field.key}`}
                                                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                                                    isOn
                                                        ? 'border-indigo-200 bg-indigo-50/70'
                                                        : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                                                }`}
                                            >
                                                <input
                                                    id={`asset-export-col-${field.key}`}
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isOn}
                                                    onChange={() => toggleField(field.key)}
                                                />
                                                {isOn ? (
                                                    <CheckSquare size={18} className="text-indigo-600 shrink-0" />
                                                ) : (
                                                    <Square size={18} className="text-slate-400 shrink-0" />
                                                )}
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {field.label}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>

                            {format === 'pdf' && showGroupByOwner ? (
                                <label
                                    htmlFor="asset-export-group-by-owner"
                                    className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3 cursor-pointer"
                                >
                                    <input
                                        id="asset-export-group-by-owner"
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600"
                                        checked={groupByOwner}
                                        onChange={(e) => setGroupByOwner(e.target.checked)}
                                    />
                                    <span className="text-sm text-slate-600">
                                        Group assets by owner (this list has multiple owners)
                                    </span>
                                </label>
                            ) : null}

                            {noneChecked ? (
                                <p className="text-xs text-rose-600 font-medium">
                                    Select at least one column to continue.
                                </p>
                            ) : null}
                        </div>
                    )}
                </div>

                <AlertDialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 gap-2 sm:gap-2">
                    <AlertDialogCancel
                        disabled={downloading}
                        className="rounded-xl border-gray-100 font-bold"
                    >
                        Cancel
                    </AlertDialogCancel>
                    {step === 2 ? (
                        <button
                            type="button"
                            disabled={downloading}
                            onClick={() => setStep(1)}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Back
                        </button>
                    ) : null}
                    {step === 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep(2)}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={downloading || noneChecked}
                            onClick={handleDownload}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                            {downloading ? 'Generating…' : 'Download'}
                        </button>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
