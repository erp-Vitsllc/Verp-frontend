'use client';

import { X, Download, FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import HandoverFormView from './HandoverFormView';
import axiosInstance from '@/utils/axios';

export default function HandoverFormModal({ isOpen, onClose, asset }) {
    const printRef = useRef();
    const [isDownloading, setIsDownloading] = useState(false);

    if (!isOpen || !asset) return null;

    const handleDownload = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await axiosInstance.get(
                `/AssetItem/handover-pdf/${asset._id}`,
                {
                    responseType: 'blob'
                }
            );

            // Create a link to download the file
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `HandoverForm-${asset.assetId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300">
                {/* Header Actions */}
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Handover Document</h2>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Preview & Download</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Download size={18} />
                            )}
                            {isDownloading ? 'Generating...' : 'Download PDF'}
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Form Preview Area */}
                <div className="flex-1 overflow-y-auto p-12 bg-gray-100/50 scrollbar-hide">
                    <div ref={printRef} className="inline-block shadow-2xl">
                        <HandoverFormView asset={asset} isPrint={false} />
                    </div>
                </div>
            </div>
        </div>
    );
}
