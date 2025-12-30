'use client';

import { memo, useMemo } from 'react';
import Image from 'next/image';
import { getInitials } from '../utils/helpers';

function ProfileHeader({
    employee,
    imageError,
    setImageError,
    handleFileSelect,
    profileCompletion,
    showProgressTooltip,
    setShowProgressTooltip,
    pendingFields,
    canSendForApproval,
    handleSubmitForApproval,
    sendingApproval,
    awaitingApproval,
    handleActivateProfile,
    activatingProfile,
    profileApproved
}) {
    return (
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-6 h-full flex flex-col">
            <div className="flex items-start gap-6">
                {/* Profile Picture - Rectangular */}
                <div className="relative flex-shrink-0 group">
                    <div className="w-32 h-40 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-blue-500 relative">
                        {(() => {
                            const rawUrl = employee.profilePicture || employee.profilePic || employee.avatar;
                            const safeUrl = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl;

                            return (safeUrl && !imageError) ? (
                                <Image
                                    src={safeUrl}
                                    alt={`${employee.firstName} ${employee.lastName}`}
                                    fill
                                    className="object-cover"
                                    onError={() => setImageError(true)}
                                    sizes="128px"
                                    priority={false}
                                    unoptimized // Bypass Next.js server optimization
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-4xl font-semibold">
                                    {getInitials(employee.firstName, employee.lastName)}
                                </div>
                            );
                        })()}
                    </div>
                    {/* Online Status Indicator */}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    {/* Camera/Edit Button */}
                    <button
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = handleFileSelect;
                            input.click();
                        }}
                        className="absolute top-2 right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Change profile picture"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                    </button>
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-800">
                                {employee.firstName} {employee.lastName}
                            </h1>
                            {employee.status && (
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${employee.status === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                        employee.status === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                            employee.status === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                                employee.status === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                    'bg-gray-100 text-gray-700'
                                        }`}>
                                        {employee.status}
                                    </span>
                                    {employee.status === 'Probation' && employee.probationPeriod && (
                                        <span className="px-2 py-1 rounded text-xs font-medium bg-[#3B82F6]/10 text-[#1D4ED8] border border-[#3B82F6]/20">
                                            {employee.probationPeriod} Month{employee.probationPeriod > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Approval Button near Status */}
                        <div className="flex items-center gap-2">
                            {canSendForApproval && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSubmitForApproval();
                                    }}
                                    disabled={sendingApproval}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                                >
                                    {sendingApproval ? 'Sending...' : 'Send for Activation'}
                                </button>
                            )}
                            {awaitingApproval && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleActivateProfile();
                                    }}
                                    disabled={activatingProfile}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                                >
                                    {activatingProfile ? 'Activating...' : 'Activate Profile'}
                                </button>
                            )}
                            {profileApproved && (
                                <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
                                    Profile activated
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-gray-600 mb-3">{employee.role || employee.designation || 'Employee'}</p>

                    {/* Contact Info */}
                    {(employee.contactNumber || employee.email || employee.workEmail) && (
                        <div className="space-y-2 mb-4">
                            {employee.contactNumber && (
                                <div className="flex items-center gap-2 text-gray-600 text-sm">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                    <span>{employee.contactNumber}</span>
                                </div>
                            )}
                            {(employee.email || employee.workEmail) && (
                                <div className="flex items-center gap-2 text-gray-600 text-sm">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                    </svg>
                                    <span>{employee.email || employee.workEmail}</span>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Profile Status */}
            <div className="mt-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Profile Status</span>
                    <span className="text-sm font-semibold text-gray-800">{profileCompletion}%</span>
                </div>
                <div
                    className="relative w-full"
                    onMouseEnter={() => setShowProgressTooltip(true)}
                    onMouseLeave={() => setShowProgressTooltip(false)}
                >
                    <div className="w-full bg-gray-200 rounded-full h-2.5 cursor-pointer">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${profileCompletion}%` }}
                        ></div>
                    </div>

                    {/* Tooltip showing next pending field */}
                    {showProgressTooltip && pendingFields.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white/95 text-gray-700 text-xs rounded-lg shadow-lg border border-gray-200 p-3 z-50 backdrop-blur-sm">
                            <div className="font-semibold mb-1.5 text-sm text-gray-800">Next to Complete:</div>
                            <div className="flex flex-col">
                                <span className="font-medium text-gray-600">{pendingFields[0].section}:</span>
                                <span className="mt-0.5 text-gray-500">{pendingFields[0].field}</span>
                            </div>
                            {pendingFields.length > 1 && (
                                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400">
                                    +{pendingFields.length - 1} more field{pendingFields.length - 1 > 1 ? 's' : ''} pending
                                </div>
                            )}
                            <div className="absolute bottom-0 left-4 transform translate-y-full">
                                <div className="border-4 border-transparent border-t-white/95"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Memoize component to prevent unnecessary re-renders
export default memo(ProfileHeader);











