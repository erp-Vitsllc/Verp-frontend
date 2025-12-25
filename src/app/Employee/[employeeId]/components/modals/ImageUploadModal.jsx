'use client';

import { useRef } from 'react';
import AvatarEditor from 'react-avatar-editor';

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
    if (!isOpen) return null;

    return (
        <>
            <style jsx global>{`
                input[type="range"].vertical-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                }
                input[type="range"].vertical-slider::-webkit-slider-runnable-track {
                    width: 200px;
                    height: 4px;
                    background: #e5e7eb;
                    border-radius: 4px;
                }
                input[type="range"].vertical-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: #3b82f6;
                    border-radius: 50%;
                    cursor: pointer;
                    margin-top: -6px;
                }
                input[type="range"].vertical-slider::-moz-range-track {
                    width: 200px;
                    height: 4px;
                    background: #e5e7eb;
                    border-radius: 4px;
                }
                input[type="range"].vertical-slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    background: #3b82f6;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                }
            `}</style>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Crop Profile Picture</h2>
                            <button
                                onClick={onClose}
                                disabled={uploading}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {selectedImage && (
                            <div className="flex gap-6 items-start">
                                {/* Image Preview Area with AvatarEditor */}
                                <div className="flex-1 flex justify-center">
                                    <div className="relative bg-gray-100 rounded-lg p-4" style={{ width: '500px', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <AvatarEditor
                                            ref={avatarEditorRef}
                                            image={selectedImage}
                                            width={400}
                                            height={400}
                                            border={0}
                                            borderRadius={200}
                                            scale={imageScale}
                                            rotate={0}
                                            color={[0, 0, 0, 0.5]}
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    </div>
                                </div>

                                {/* Vertical Zoom Slider */}
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (imageScale < 3) {
                                                const newScale = Math.min(3, imageScale + 0.1);
                                                setImageScale(newScale);
                                            }
                                        }}
                                        disabled={uploading || imageScale >= 3}
                                        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Zoom In"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </button>

                                    <div className="relative flex flex-col items-center">
                                        <div
                                            className="relative bg-gray-200 rounded-full"
                                            style={{
                                                height: '200px',
                                                width: '4px',
                                                position: 'relative'
                                            }}
                                        >
                                            <input
                                                type="range"
                                                min="1"
                                                max="3"
                                                step="0.01"
                                                value={imageScale}
                                                onChange={(e) => {
                                                    const newScale = parseFloat(e.target.value);
                                                    setImageScale(newScale);
                                                }}
                                                disabled={uploading}
                                                className="absolute vertical-slider cursor-pointer disabled:opacity-50"
                                                style={{
                                                    width: '200px',
                                                    height: '4px',
                                                    transform: 'rotate(-90deg)',
                                                    transformOrigin: 'center',
                                                    left: '-98px',
                                                    top: '98px',
                                                    background: 'transparent'
                                                }}
                                            />
                                        </div>
                                        <div className="mt-2 text-xs text-gray-600 font-medium">
                                            {Math.round(imageScale * 100)}%
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (imageScale > 1) {
                                                const newScale = Math.max(1, imageScale - 0.1);
                                                setImageScale(newScale);
                                            }
                                        }}
                                        disabled={uploading || imageScale <= 1}
                                        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Zoom Out"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </button>
                                </div>

                                {/* Controls */}
                                <div className="flex flex-col gap-4 w-48">
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2">
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
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Change Image
                                        </button>
                                        <button
                                            onClick={onUpload}
                                            disabled={uploading || !selectedImage}
                                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {uploading ? 'Uploading...' : 'Save & Upload'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}




