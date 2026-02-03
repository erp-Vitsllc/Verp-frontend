'use client';
import React, { useRef, useState, useEffect } from 'react';

const SignatureModal = ({ isOpen, onClose, onSave, employeeName }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d', { alpha: true });
            ctx.strokeStyle = '#0f172a'; // Slate 900
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Handle high DPI displays
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            // Reset style after resize
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [isOpen]);

    const startDrawing = (e) => {
        const { offsetX, offsetY } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
        setHasSigned(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { offsetX: 0, offsetY: 0 };

        const rect = canvas.getBoundingClientRect();

        if (e.touches && e.touches[0]) {
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }

        return {
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        };
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        setHasSigned(false);
    };

    const handleSave = async () => {
        if (!hasSigned) return;

        const canvas = canvasRef.current;
        // signatureData is base64 PNG
        const signatureData = canvas.toDataURL('image/png');

        setIsSaving(true);
        try {
            await onSave(signatureData);
            onClose();
        } catch (error) {
            console.error("Signature Save Error:", error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Digital Signature</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">e-Sign Agreement for {employeeName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-900 transition-all shadow-sm active:scale-90"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Canvas Area */}
                <div className="p-8">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-crosshair">
                            <canvas
                                ref={canvasRef}
                                className="w-full h-[350px] touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />

                            {!hasSigned && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-300 mb-2">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                    <p className="text-sm font-bold text-slate-400 tracking-tight">Sign with mouse or touch</p>
                                </div>
                            )}

                            <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none">
                                <p className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Legal e-Signature Pad</p>
                            </div>
                        </div>
                    </div>

                    <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
                        This signature will be stored as a high-resolution PNG on IDrive Secure Storage.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                    <button
                        onClick={clear}
                        disabled={!hasSigned || isSaving}
                        className="text-xs font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                        Clear Canvas
                    </button>

                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasSigned || isSaving}
                            className={`px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg active:shadow-md ${!hasSigned || isSaving
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                                }`}
                        >
                            {isSaving ? 'Processing...' : 'Save Signature'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;
