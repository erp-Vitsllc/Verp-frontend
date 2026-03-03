import React, { useState } from 'react';
import { X, Search, Upload, FileText, AlertTriangle } from 'lucide-react';
import axiosInstance from '@/utils/axios';

const EndOfLifeModal = ({ isOpen, onClose, assetName, onConfirm, type = "End of Life" }) => {
    const [reason, setReason] = useState('');
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onload = () => {
                setFile(reader.result);
            };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!reason.trim()) {
            setError('Please provide a reason for end of life.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onConfirm({ reason, attachment: file });
        } catch (err) {
            setError(err.message || 'Failed to submit end of life request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-rose-50 bg-rose-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                            <AlertTriangle size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-rose-900 tracking-tight">{type} (Request Approval)</h2>
                            <p className="text-[11px] font-bold text-rose-500 uppercase tracking-widest">{assetName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-rose-100 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 rounded-2xl border border-rose-100 text-sm font-bold text-rose-600 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-widest">
                                Reason for {type} <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="E.g., Asset unrepairable, totally damaged, outdated..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none shadow-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-widest">
                                Attachment (Optional)
                            </label>
                            <div className="relative group cursor-pointer">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                />
                                <div className="w-full flex items-center gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm transition-all group-hover:border-rose-300 group-hover:bg-rose-50/30">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-rose-500 group-hover:border-rose-200 shadow-sm transition-all">
                                        <Upload size={18} strokeWidth={2} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {file ? (
                                            <p className="font-bold text-slate-700 truncate flex items-center gap-2">
                                                <FileText size={14} className="text-rose-500 shrink-0" />
                                                File selected
                                            </p>
                                        ) : (
                                            <div>
                                                <p className="font-bold text-slate-600 group-hover:text-rose-600 transition-colors">Click or drag file to upload</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Support: PDF, JPG, PNG</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                `Request ${type}`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EndOfLifeModal;
