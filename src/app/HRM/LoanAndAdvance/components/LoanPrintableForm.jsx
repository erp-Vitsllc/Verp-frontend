'use client';

export default function LoanPrintableForm({
    loan,
    employee,
    formatDate,
    installmentAmount,
    startDate,
    endDate,
    previousLoanAmount,
    calculateServiceYears,
    className = '',
}) {
    if (!loan) return null;

    return (
        <div
            id="loan-form-container"
            className={`mx-auto bg-white shadow-lg w-[210mm] relative text-black text-sm font-serif print:shadow-none print:w-full print:m-0 ${className}`}
            style={{ fontFamily: 'Times New Roman, serif' }}
        >
            <div className="relative w-full z-0">
                <img src="/assets/loan_bg_final.jpg" alt="Background" className="w-full h-auto block" />
            </div>

            <div className="absolute inset-0 z-10 p-6 pt-20 pb-4 flex flex-col h-full text-gray-800 leading-snug">
                <div className="border-black pb-1 mb-2 w-max mt-4 mx-auto">
                    <h1 className="text-xl font-bold uppercase underline decoration-1 underline-offset-2 text-gray-900">
                        {loan.type === 'Loan' ? 'LOAN REQUEST FORM' : ' SALARY ADVANCE REQUEST FORM'}
                    </h1>
                </div>

                <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-x-2 gap-y-3 items-baseline mt-4 w-full">
                    <div className="flex items-baseline min-w-0">
                        <span className="whitespace-nowrap">Applicant Name:</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 break-words leading-tight text-sm min-w-0">{loan.applicantName}</span>
                    </div>
                    <div className="flex items-baseline min-w-0">
                        <span className="whitespace-nowrap ml-2">Department:</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 break-words leading-tight text-sm min-w-0">{loan.department}</span>
                    </div>
                    <div className="flex items-baseline min-w-0">
                        <span className="whitespace-nowrap ml-2">Designation:</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 break-words leading-tight text-sm min-w-0">{loan.designation}</span>
                    </div>
                </div>

                <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr] gap-x-4 gap-y-3 items-baseline mt-5 w-full">
                    <div className="flex items-baseline min-w-0">
                        <span className="whitespace-nowrap">HOD Name:</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 break-words leading-tight text-sm min-w-0">{loan.hodName}</span>
                    </div>
                    <div className="flex items-baseline min-w-0">
                        <span className="whitespace-nowrap ml-2">Amount (AED):</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 whitespace-nowrap leading-tight text-sm min-w-0">{Number(loan.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex items-baseline min-w-0">
                        <span className="whitespace-nowrap ml-2">Reason:</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2 break-words leading-tight text-sm min-w-0">{loan.reason}</span>
                    </div>
                </div>

                {['Approved', 'Pending Payment to Employee', 'Paid'].includes(loan.approvalStatus || loan.status) && (() => {
                    const paidAmount = loan.paidAmount || 0;
                    const remainingAmount = Math.max(0, (loan.amount || 0) - paidAmount);
                    return (
                        <div className="grid grid-cols-[1.2fr_1.5fr_1fr] gap-x-4 gap-y-3 items-baseline mt-3 w-full">
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap">Paid Amount (AED):</span>
                                <span className="font-bold flex-1 border-b border-dotted border-green-600 px-2 whitespace-nowrap leading-tight text-sm min-w-0 text-green-700">{Number(paidAmount).toLocaleString()}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">Remaining Amount (AED):</span>
                                <span className="font-bold flex-1 border-b border-dotted border-red-600 px-2 whitespace-nowrap leading-tight text-sm min-w-0 text-red-700">{Number(remainingAmount).toLocaleString()}</span>
                            </div>
                            <div className="flex items-baseline min-w-0" />
                        </div>
                    );
                })()}

                <div className="mt-5 text-justify font-serif text-sm leading-relaxed">
                    I <span className="font-bold border-b border-dotted border-gray-900 px-1 inline-block min-w-[80px] text-center break-words">{loan.applicantName}</span> request the above-mentioned cash advance and hereby authorize to deduct the same from my upcoming salary or End of Service Benefit.
                </div>

                <div className="flex gap-2 items-baseline mt-6 flex-wrap">
                    <div className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap">Installment Amount / Month:</span>
                        <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[80px]">{installmentAmount}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap ml-2">Repayment Starting From:</span>
                        <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[90px]">{formatDate(startDate)}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap">To</span>
                        <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[90px]">{formatDate(endDate)}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="whitespace-nowrap ml-2">No. of Installments:</span>
                        <span className="font-bold border-b border-dotted border-gray-400 px-2 min-w-[40px] text-center">{loan.duration}</span>
                    </div>
                </div>

                <div className="flex justify-between items-baseline mt-8 flex-wrap gap-4">
                    <div className="flex gap-2 items-baseline w-full sm:w-[45%]">
                        <span className="whitespace-nowrap">Date:</span>
                        <span className="font-bold flex-1 border-b border-dotted border-gray-400 px-2">{formatDate(loan.appliedDate)}</span>
                    </div>
                    <div className="flex gap-2 items-baseline w-full sm:w-[45%]">
                        <span className="whitespace-nowrap">Signature:</span>
                        <span className="flex-1 border-b border-dotted border-gray-400 h-8" />
                    </div>
                </div>

                <div className="mt-4">
                    <h3 className="font-bold underline mb-2 text-gray-900">HR DEPARTMENT</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-2 gap-y-3 items-baseline w-full">
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap">Employee No.:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{employee?.employeeId || loan.employeeId}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">VISA Exp:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{formatDate(employee?.visaDetails?.employment?.expiryDate || employee?.visaDetails?.spouse?.expiryDate)}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">Labour Card Exp:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{formatDate(employee?.labourCardDetails?.expiryDate)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-2 gap-y-3 items-baseline w-full">
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap">Joining Date:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{formatDate(employee?.dateOfJoining || employee?.contractJoiningDate)}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">Year of Service:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{calculateServiceYears(employee?.dateOfJoining || employee?.contractJoiningDate)}</span>
                            </div>
                            <div className="flex items-baseline min-w-0" />
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <h3 className="font-bold underline mb-2 text-gray-900">FINANCE DEPARTMENT</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-[1.2fr_1fr_1.1fr] gap-x-4 gap-y-3 items-baseline w-full">
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap">Previous Advance if any (AED):</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 whitespace-nowrap leading-tight text-sm min-w-0">{previousLoanAmount ? Number(previousLoanAmount).toLocaleString() : ''}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">Salary Payable (AED):</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 whitespace-nowrap leading-tight text-sm min-w-0">{employee ? Number(employee.totalSalary || employee.monthlySalary || 0).toLocaleString() : ''}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">Till Date:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{formatDate(endDate)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-[1.5fr_1.5fr_1fr] gap-x-2 gap-y-3 items-baseline w-full">
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap">Installment Amount:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 whitespace-nowrap leading-tight text-sm min-w-0">{installmentAmount}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">Repayment Starting From:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{formatDate(startDate)}</span>
                            </div>
                            <div className="flex items-baseline min-w-0">
                                <span className="whitespace-nowrap ml-2">To:</span>
                                <span className="font-bold border-b border-dotted border-gray-400 px-2 flex-1 break-words leading-tight text-sm min-w-0">{formatDate(endDate)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <h3 className="font-bold underline mb-2 text-gray-900">MANAGEMENT APPROVAL</h3>
                    <div className="p-3 space-y-4 bg-white/50 text-xs">
                        <div className="flex gap-2 items-baseline">
                            <span>Approved Amount:</span>
                            <span className="flex-1 border-b border-dotted border-gray-300" />
                            <span>Installment Amount Per Month:</span>
                            <span className="flex-1 border-b border-dotted border-gray-300" />
                            <span>Duration:</span>
                            <span className="flex-[0.5] border-b border-dotted border-gray-300" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
