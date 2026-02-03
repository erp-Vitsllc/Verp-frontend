'use client';

import { useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

export default function NoticeApprovalModal({ isOpen, onClose, employeeId, employee, currentUser, noticeRequest, onSuccess, onViewDocument }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen || !noticeRequest) return null;

    const handleAction = async (status) => {
        console.log('NoticeApprovalModal triggered:', status);
        setIsLoading(true);
        try {
            await axiosInstance.patch(`/Employee/${employeeId}/update-notice-status`, {
                status,
                actionedBy: currentUser?.id || currentUser?._id // Send user ID
            });

            toast({ title: "Success", description: `Request ${status} successfully.` });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || `Failed to ${status} request`
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-800">Notice Request Approval</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 space-y-2">
                        {employee && (
                            <div className="flex items-center gap-4 mb-4 border-b border-orange-200 pb-4">
                                <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                                    <Image
                                        src={(() => {
                                            const pic = employee.profilePicture || employee.profilePic || employee.avatar;
                                            if (pic && typeof pic === 'object' && pic.url) return pic.url;
                                            if (typeof pic === 'string' && pic.trim() !== '') return pic;
                                            return '/default-avatar.png';
                                        })()}
                                        alt="Profile"
                                        fill
                                        className="object-cover"
                                        onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }} // Fallback on load error
                                    />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">{`${employee.firstName || ''} ${employee.lastName || ''}`}</h4>
                                    <p className="text-xs text-gray-500">{employee.designation || 'No Designation'}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100">
                                            {employee.employeeId}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${employee.status === 'Probation' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            employee.status === 'Permanent' ? 'bg-green-50 text-green-700 border-green-100' :
                                                'bg-gray-50 text-gray-700 border-gray-100'
                                            }`}>
                                            {employee.status || 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-sm font-medium text-orange-800">Duration</span>
                            <span className="text-sm text-orange-700">{noticeRequest.duration || 'Duration not specified'}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-orange-800">Reason</span>
                            <span className="text-sm text-orange-700">{noticeRequest.reason || 'No reason provided'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-orange-800">Attachment</span>
                            {noticeRequest.attachment?.url ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onViewDocument) {
                                            onViewDocument({
                                                data: noticeRequest.attachment.url,
                                                name: noticeRequest.attachment.name || 'Notice Attachment',
                                                mimeType: noticeRequest.attachment.mimeType || 'application/pdf',
                                                moduleId: 'hrm_employees_view_work'
                                            });
                                        } else {
                                            window.open(noticeRequest.attachment.url, '_blank');
                                        }
                                    }}
                                    className="text-green-600 hover:text-green-700 transition-colors"
                                    title="View Document"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </button>
                            ) : (
                                <span className="text-xs text-gray-400">No attachment</span>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => handleAction('Rejected')}
                            className="flex-1 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            disabled={isLoading}
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAction('Approved')}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Processing...' : 'Approve'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
