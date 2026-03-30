'use client';
import { useState, useRef } from 'react';
import { Fingerprint, PenTool, ShieldCheck, Eye, Upload, FileText } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import SignatureModal from '../modals/SignatureModal';

export default function SignatureCard({ employee, formatDate, fetchEmployee, isAdmin, hasPermission, onViewDocument }) {
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleSaveSignature = async (signatureData, fileName = undefined) => {
        try {
            await axiosInstance.post(`/Employee/${employee._id || employee.id}/upload-signature`, { signatureData, fileName });
            toast({
                title: "Signature Saved",
                description: "Digital signature has been stored securely in IDrive e2.",
            });
            if (fetchEmployee) await fetchEmployee();
        } catch (error) {
            console.error("Signature upload failed", error);
            toast({
                variant: "destructive",
                title: "Upload Failed",
                description: error.response?.data?.message || "Could not save signature."
            });
            throw error;
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const base64data = reader.result;
                await handleSaveSignature(base64data, file.name);
            } catch (err) {
                // error handled in save
            } finally {
                setIsUploading(false);
                e.target.value = null; // Reset input
            }
        };
        reader.onerror = () => {
            setIsUploading(false);
            toast({ variant: 'destructive', title: 'Error reading file' });
        };
    };

    if (!(isAdmin() || hasPermission('hrm_employees_view_work', 'isView'))) {
        return null;
    }

    const isPdf =
        employee.signature?.mimeType === 'application/pdf' ||
        employee.signature?.format === 'pdf' ||
        employee.signature?.name?.toLowerCase?.().endsWith?.('.pdf') ||
        employee.signature?.url?.toLowerCase?.().endsWith?.('.pdf');

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/30">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-800">Digital Signature</h3>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider">Secure e-Sign</span>
            </div>

            <div className="p-8 flex-grow flex flex-col items-center justify-center min-h-[400px]">
                {employee.signature?.url ? (
                    <div className="w-full flex flex-col items-center gap-4">
                        <div
                            className="relative group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all w-full max-w-[280px]"
                        >
                            {isPdf ? (
                                <div className="h-48 w-full bg-slate-50 rounded-xl flex flex-col items-center justify-center border border-slate-200 gap-3">
                                    <FileText size={48} className="text-red-500" />
                                    <span className="text-xs font-bold text-slate-500">PDF Signature Document</span>
                                </div>
                            ) : (
                                <img
                                    src={employee.signature.url}
                                    alt="Employee Signature"
                                    className="h-48 w-full object-contain mix-blend-multiply"
                                />
                            )}

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 rounded-2xl transition-all duration-200 backdrop-blur-[1px]">
                                <button
                                    onClick={() => onViewDocument?.({
                                        data: employee.signature.url,
                                        name: employee.signature.name || 'Employee Signature Document',
                                        mimeType: employee.signature.mimeType || (isPdf ? 'application/pdf' : 'image/png')
                                    })}
                                    className="bg-white p-2.5 rounded-full shadow-lg scale-90 hover:scale-110 active:scale-95 transition-transform text-slate-900 hover:text-blue-600"
                                    title="View Document"
                                >
                                    <Eye className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setIsSignatureModalOpen(true)}
                                    className="bg-white p-2.5 rounded-full shadow-lg scale-90 hover:scale-110 active:scale-95 transition-transform text-slate-900 hover:text-blue-600"
                                    title="Draw New Signature"
                                >
                                    <PenTool className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-white p-2.5 rounded-full shadow-lg scale-90 hover:scale-110 active:scale-95 transition-transform text-slate-900 hover:text-blue-600"
                                    title="Upload New Document"
                                >
                                    <Upload className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isPdf ? 'Uploaded Document' : 'Authenticated Signature'}</p>
                            <p className="text-xs font-bold text-slate-600 mt-1">Signed on {formatDate(employee.signature.signedAt)}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner">
                            <Fingerprint className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="text-center space-y-2">
                            <h4 className="text-sm font-black text-slate-800">No Signature on File</h4>
                            <p className="text-xs font-bold text-slate-400 max-w-[200px] leading-relaxed">
                                Please provide a digital signature or upload an authorized document.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsSignatureModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                            >
                                <PenTool className="w-4 h-4" />
                                Draw
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center italic">
                    Legally Binding Digital Signature
                </p>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
            />

            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={(data) => handleSaveSignature(data)}
                employeeName={`${employee.firstName} ${employee.lastName}`}
            />
        </div>
    );
}
