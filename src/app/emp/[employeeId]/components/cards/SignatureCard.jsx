'use client';
import { useState } from 'react';
import { Fingerprint, PenTool, ShieldCheck, Eye } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import SignatureModal from '../modals/SignatureModal';

export default function SignatureCard({ employee, formatDate, fetchEmployee, isAdmin, hasPermission, onViewDocument }) {
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    const handleSaveSignature = async (signatureData) => {
        try {
            await axiosInstance.post(`/Employee/${employee._id || employee.id}/upload-signature`, { signatureData });
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

    if (!(isAdmin() || hasPermission('hrm_employees_view_work', 'isView'))) {
        return null;
    }

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
                            <img
                                src={employee.signature.url}
                                alt="Employee Signature"
                                className="h-48 w-full object-contain mix-blend-multiply"
                            />

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 rounded-2xl transition-all duration-200 backdrop-blur-[1px]">
                                <button
                                    onClick={() => onViewDocument?.({ data: employee.signature.url, name: 'Employee Signature', mimeType: 'image/png' })}
                                    className="bg-white p-2.5 rounded-full shadow-lg scale-90 hover:scale-110 active:scale-95 transition-transform text-slate-900 hover:text-blue-600"
                                    title="View Full Signature"
                                >
                                    <Eye className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setIsSignatureModalOpen(true)}
                                    className="bg-white p-2.5 rounded-full shadow-lg scale-90 hover:scale-110 active:scale-95 transition-transform text-slate-900 hover:text-blue-600"
                                    title="Update Signature"
                                >
                                    <PenTool className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authenticated Signature</p>
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
                                Please provide a digital signature to authorize company documents.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsSignatureModalOpen(true)}
                            className="flex items-center gap-3 px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                        >
                            <PenTool className="w-4 h-4" />
                            Click to Sign
                        </button>
                    </div>
                )}
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center italic">
                    Legally Binding Digital Signature
                </p>
            </div>

            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleSaveSignature}
                employeeName={`${employee.firstName} ${employee.lastName}`}
            />
        </div>
    );
}
