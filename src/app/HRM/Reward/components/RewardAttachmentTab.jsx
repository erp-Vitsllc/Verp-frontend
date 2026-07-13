'use client';

import { Download, FileText, Paperclip } from 'lucide-react';
import { FineFormCard } from '../../Fine/components/FineFormCardShared';
import RewardCertificatePreview from './RewardCertificatePreview';

/**
 * Attachment tab — always shows live certificate from reward data + optional upload.
 */
export default function RewardAttachmentTab({
    reward,
    employeeDisplayName = '',
    headerText,
    subHeaderText,
    presentationText,
    signer1Name,
    signer1Title,
    signer2Name,
    signer2Title,
    onDownloadCertificate,
    downloading = false,
}) {
    if (!reward) return null;

    const uploadAttachment = reward.attachment;
    const hasUpload = Boolean(uploadAttachment?.url);
    const certAttachment = reward.certificateAttachment;
    const hasSavedCert = Boolean(certAttachment?.url);

    return (
        <div className="flex flex-col gap-6 w-full min-w-0 print:hidden">
            <FineFormCard
                icon={FileText}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                title="Certificate"
                subtitle="Auto-generated from this reward’s details (any status)"
                headerAction={
                    <button
                        type="button"
                        onClick={onDownloadCertificate}
                        disabled={downloading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Download size={14} />
                        Download PDF
                    </button>
                }
            >
                <div className="w-full overflow-x-auto">
                    <RewardCertificatePreview
                        headerText={headerText}
                        subHeaderText={subHeaderText}
                        presentationText={presentationText}
                        employeeDisplayName={employeeDisplayName}
                        title={reward.title}
                        rewardType={reward.rewardType}
                        giftName={reward.giftName}
                        amount={reward.amount}
                        currency={reward.currency || 'AED'}
                        signer1Name={signer1Name}
                        signer1Title={signer1Title}
                        signer2Name={signer2Name}
                        signer2Title={signer2Title}
                        onDownload={onDownloadCertificate}
                        downloading={downloading}
                        showDownloadButton={false}
                    />
                </div>

                {hasSavedCert ? (
                    <a
                        href={certAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <FileText size={18} className="text-amber-600 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                    {certAttachment.name || `Certificate-${reward.rewardId}.pdf`}
                                </p>
                                <p className="text-xs text-gray-500">Saved certificate file</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-amber-700 shrink-0">Open</span>
                    </a>
                ) : null}
            </FineFormCard>

            <FineFormCard
                icon={Paperclip}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                title="Uploaded Attachment"
                subtitle="Optional file uploaded with the reward request"
            >
                {hasUpload ? (
                    <a
                        href={uploadAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-white border border-gray-100 text-blue-600 shrink-0">
                                <FileText size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                    {uploadAttachment.name || 'Reward attachment'}
                                </p>
                                <p className="text-xs text-gray-500">{uploadAttachment.mimeType || 'File'}</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 shrink-0">Open</span>
                    </a>
                ) : (
                    <p className="text-sm text-gray-400 text-center py-6">No file was uploaded with this reward.</p>
                )}
            </FineFormCard>
        </div>
    );
}
