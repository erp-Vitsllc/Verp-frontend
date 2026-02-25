'use client';

import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { X, ZoomIn, ZoomOut, Upload, RotateCw, Check, Camera } from 'lucide-react';

export default function ImageUploadModal({
    isOpen,
    onClose,
    selectedImage,
    imageScale,
    setImageScale,
    uploading,
    error,
    avatarEditorRef,
    onFileSelect,
    onUpload
}) {
    const [rotation, setRotation] = useState(0);

    if (!isOpen) return null;

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Adjust Picture</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Crop and scale your image for the perfect fit</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    {selectedImage ? (
                        <div className="flex flex-col items-center gap-8">
                            {/* Editor Area */}
                            <div className="relative group">
                                <div className="p-2 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 shadow-inner group-hover:border-blue-400 transition-colors duration-500">
                                    <AvatarEditor
                                        ref={avatarEditorRef}
                                        image={selectedImage}
                                        width={320}
                                        height={320}
                                        border={20}
                                        borderRadius={160} // Circle for profile
                                        scale={imageScale}
                                        rotate={rotation}
                                        color={[255, 255, 255, 0.8]}
                                        style={{ borderRadius: '160px' }}
                                    />
                                </div>

                                {/* Quick Actions Overlay */}
                                <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                    <button
                                        onClick={handleRotate}
                                        className="w-10 h-10 bg-white shadow-lg border border-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:text-blue-600 hover:scale-110 transition-all"
                                        title="Rotate 90°"
                                    >
                                        <RotateCw size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Zoom Control */}
                            <div className="w-full max-w-sm flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <ZoomOut size={18} className="text-slate-400" />
                                <div className="flex-1 relative flex items-center">
                                    <input
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="0.01"
                                        value={imageScale}
                                        onChange={(e) => setImageScale(parseFloat(e.target.value))}
                                        disabled={uploading}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    {/* Tick Marks for scale */}
                                    <div className="absolute inset-x-0 -bottom-1 flex justify-between pointer-events-none">
                                        <div className="w-0.5 h-1 bg-slate-300"></div>
                                        <div className="w-0.5 h-1 bg-slate-300"></div>
                                        <div className="w-0.5 h-1 bg-slate-300"></div>
                                    </div>
                                </div>
                                <ZoomIn size={18} className="text-slate-400" />
                            </div>

                            {/* Status & Errors */}
                            {error && (
                                <div className="w-full bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0">!</div>
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3 w-full border-t border-slate-100 pt-8">
                                <button
                                    onClick={() => {
                                        if (!uploading) {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = onFileSelect;
                                            input.click();
                                        }
                                    }}
                                    disabled={uploading}
                                    className="flex-1 h-14 border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Upload size={16} /> Change Image
                                </button>
                                <button
                                    onClick={onUpload}
                                    disabled={uploading || !selectedImage}
                                    className="flex-[1.5] h-14 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={16} /> Save & Apply
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50">
                            <div className="w-20 h-20 bg-white shadow-xl shadow-slate-200/50 rounded-3xl flex items-center justify-center text-blue-600 mb-6 border border-slate-100">
                                <Camera size={32} />
                            </div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">No Image Selected</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-8">Please select a photo to begin cropping</p>
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = onFileSelect;
                                    input.click();
                                }}
                                className="px-8 py-4 bg-white border border-slate-200 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white hover:shadow-xl hover:shadow-blue-100 transition-all"
                            >
                                Browse Files
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}




