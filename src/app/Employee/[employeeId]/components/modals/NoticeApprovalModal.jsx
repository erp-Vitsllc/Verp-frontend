'use client';

import { useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";

export default function NoticeApprovalModal({ isOpen, onClose, employeeId, employee, noticeRequest, onSuccess }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen || !noticeRequest) return null;

    const handleAction = async (status) => {
        setIsLoading(true);
        try {
            await axiosInstance.patch(`/Employee/${employeeId}/update-notice-status`, {
                status,
                // actionedBy: user.id // Ideally get from context, but backend might infer or we can skip for now
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
                            <>
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium text-orange-800">Employee Name</span>
                                    <span className="text-sm text-orange-700">{`${employee.firstName || ''} ${employee.lastName || ''}`}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium text-orange-800">Employee ID</span>
                                    <span className="text-sm text-orange-700">{employee.employeeId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium text-orange-800">Department</span>
                                    <span className="text-sm text-orange-700">{employee.department || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium text-orange-800">Designation</span>
                                    <span className="text-sm text-orange-700">{employee.designation || 'N/A'}</span>
                                </div>
                                <div className="border-t border-orange-200 my-2"></div>
                            </>
                        )}
                        <div className="flex justify-between">
                            <span className="text-sm font-medium text-orange-800">Duration</span>
                            <span className="text-sm text-orange-700">{noticeRequest.duration}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-orange-800">Reason</span>
                            <span className="text-sm text-orange-700">{noticeRequest.reason}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-orange-800">Attachment</span>
                            {noticeRequest.attachment?.url ? (
                                <a
                                    href={noticeRequest.attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-white border border-orange-200 text-orange-600 px-2 py-1 rounded hover:bg-orange-100 transition"
                                >
                                    View Document
                                </a>
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
