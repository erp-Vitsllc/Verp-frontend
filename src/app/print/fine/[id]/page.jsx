'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function FinePrintPage() {
    const { id } = useParams();
    const [fine, setFine] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                if (!token) throw new Error('Authentication token not found');

                const headers = { 'Authorization': `Bearer ${token}` };

                // 1. Fetch Fine
                const fineRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/Fine/${id}`, { headers });
                if (!fineRes.ok) throw new Error('Failed to fetch fine');
                const fineData = await fineRes.json();
                setFine(fineData);

                // 2. Fetch Employee for Stats (Visa Expiry, Join Date etc.)
                // Use the first assigned employee for the main details or iterate?
                // The form in image seems to be for ONE employee.
                // If fine has multiple assigned, we might need a param to pick one, or just pick the first.
                const targetEmpId = fineData.assignedEmployees?.[0]?.employeeId;

                if (targetEmpId) {
                    const empRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/Employee/${targetEmpId}`, { headers });
                    if (empRes.ok) {
                        const empData = await empRes.json();
                        setEmployee(empData);
                    }
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Error loading print data:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        if (id) fetchData();
    }, [id]);

    if (isLoading) return <div id="fine-form-container" className="p-10 text-center">Loading Fine Form...</div>;
    if (error) return <div id="fine-form-container" className="p-10 text-center text-red-600">Error: {error}</div>;
    if (!fine) return null;


    // Helper: Add months to a YYYY-MM string
    const calculateEndMonth = (startStr, duration) => {
        if (!startStr || !duration) return 'N/A';
        try {
            const [year, month] = startStr.split('-').map(Number);
            const date = new Date(year, month - 1); // JS months are 0-indexed
            date.setMonth(date.getMonth() + (Number(duration) - 1)); // -1 because start month counts as 1
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } catch (e) {
            return 'N/A';
        }
    };

    const installments = fine.payableDuration || 1;
    const startMonth = fine.monthStart || 'N/A';
    const endMonth = calculateEndMonth(fine.monthStart, fine.payableDuration);

    // Placeholder calculations for missing backend fields
    const totalFine = Number(fine.fineAmount || 0).toLocaleString();
    const paidFine = "0"; // Placeholder: Need backend logic for paid amount
    const outstanding = totalFine; // Placeholder

    // HOD Logic (Mock - based on dept head usually)
    const hodName = "______________________"; // Placeholder for signature/name

    /* CSS for Print - ensure background colors show */
    const printStyles = `
        @media print {
            body { -webkit-print-color-adjust: exact; }
            #fine-form-container { padding: 0; margin: 0; width: 100%; max-width: none; }
            @page { margin: 1cm; size: A4; }
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: printStyles }} />
            <div id="fine-form-container" className="max-w-[210mm] mx-auto bg-white p-8 text-sm text-black leading-tight" style={{ fontFamily: 'Arial, sans-serif' }}>

                {/* Header Logo Area */}
                <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-2">
                    <img src="/assets/images/logo.png" alt="VEGA Logo" className="h-12 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                    <div className="hidden text-right"> {/* Fallback if logo fails */}
                        <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wider">VEGA</h1>
                        <p className="text-[10px] text-gray-600 font-bold tracking-widest">DIGITAL IT SOLUTIONS LLC</p>
                    </div>
                    <div className="text-right text-xs font-bold text-gray-800">
                        FINE FORM
                    </div>
                </div>

                {/* Fine Details Table */}
                <div className="w-full">
                    <div className="bg-[#b3d9ff] border border-black font-bold text-center py-1 border-b-0 text-xs uppercase tracking-wide">Fine Details</div>
                    <table className="w-full border-collapse border border-black mb-4">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[18%] text-xs">Employee Name</td>
                                <td className="border border-black p-1.5 w-[32%] uppercase">{fine.assignedEmployees?.[0]?.employeeName}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold w-[18%] text-xs">Department</td>
                                <td className="border border-black p-1.5 w-[32%] uppercase">{employee?.department}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">HOD Name</td>
                                <td className="border border-black p-1.5">{hodName}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Designation</td>
                                <td className="border border-black p-1.5 uppercase">{employee?.designation}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Fine Type</td>
                                <td className="border border-black p-1.5 uppercase">{fine.fineType}</td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Fine Reason</td>
                                <td className="border border-black p-1.5 uppercase">{fine.category}</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Fine Amount</td>
                                <td className="border border-black p-1.5 font-semibold text-red-700">{fine.fineAmount?.toLocaleString()} <span className="text-black text-[10px] font-normal">AED</span></td>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Service Charge</td>
                                <td className="border border-black p-1.5">0.00</td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs h-24 align-top">
                                    Fine Description
                                </td>
                                <td className="border border-black p-1.5 align-top" colSpan={3}>
                                    <div className="whitespace-pre-wrap">{fine.description}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Acknowledgment Text */}
                <div className="mb-4 text-[11px] text-justify leading-relaxed">
                    I <span className="font-bold underline px-1">{fine.assignedEmployees?.[0]?.employeeName}</span> acknowledge that the fine mentioned above has been committed due to my responsibility. I understand and accept that I am accountable for this charge. I hereby authorize the deduction of the specified amount from my upcoming salary, as per the schedule outlined below:
                </div>

                {/* Account / HR Department Table */}
                <div className="w-full">
                    <div className="bg-[#b3d9ff] border border-black font-bold text-center py-1 border-b-0 text-xs uppercase tracking-wide">Account / HR Department</div>
                    <table className="w-full border-collapse border border-black mb-4">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="border border-black p-1.5 w-1/3 text-xs">No Of Installments</th>
                                <th className="border border-black p-1.5 w-1/3 text-xs">Start Month/Year</th>
                                <th className="border border-black p-1.5 w-1/3 text-xs">End Month/Year</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1.5 text-center font-semibold">{installments}</td>
                                <td className="border border-black p-1.5 text-center">{startMonth}</td>
                                <td className="border border-black p-1.5 text-center">{endMonth}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Employee Stats & History Table */}
                <table className="w-full border-collapse border border-black mb-4">
                    <tbody>
                        <tr>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold w-[25%] text-xs">Visa Expiry</td>
                            <td className="border border-black p-1.5 w-[25%]">{visaExpiry ? new Date(visaExpiry).toLocaleDateString() : '-'}</td>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold w-[25%] text-xs">Labour Card Expiry</td>
                            <td className="border border-black p-1.5 w-[25%]">{laborExpiry ? new Date(laborExpiry).toLocaleDateString() : '-'}</td>
                        </tr>
                        <tr>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Joining Date</td>
                            <td className="border border-black p-1.5">{joinDate ? joinDate.toLocaleDateString() : '-'}</td>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Years Of Service</td>
                            <td className="border border-black p-1.5">{yearsOfService} Years</td>
                        </tr>
                        <tr>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Total Fine</td>
                            <td className="border border-black p-1.5">{totalFine}</td>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Total Fine Type</td>
                            <td className="border border-black p-1.5">1</td>
                        </tr>
                        <tr>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Paid Fine</td>
                            <td className="border border-black p-1.5">{paidFine}</td>
                            <td className="border border-black bg-gray-100 p-1.5 font-bold text-xs">Outstanding Balance</td>
                            <td className="border border-black p-1.5 font-bold text-red-700">{outstanding}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Fine Breakdown Table */}
                <div className="w-full mb-4">
                    <div className="text-xs font-bold mb-1">Fine History Breakdown</div>
                    <table className="w-full border-collapse border border-black text-center text-xs">
                        <thead>
                            <tr className="bg-[#b3d9ff]">
                                <th className="border border-black p-1">Fine Type</th>
                                <th className="border border-black p-1">Fine Amount</th>
                                <th className="border border-black p-1">Duration</th>
                                <th className="border border-black p-1">Paid Amount</th>
                                <th className="border border-black p-1">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 font-semibold">{fine.fineType}</td>
                                <td className="border border-black p-1">{Number(fine.fineAmount).toLocaleString()}</td>
                                <td className="border border-black p-1">{fine.payableDuration || 1} Mth</td>
                                <td className="border border-black p-1">0</td>
                                <td className="border border-black p-1">{Number(fine.fineAmount).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Loan Breakdown Table */}
                <div className="w-full mb-4">
                    <div className="text-xs font-bold mb-1">Loan / Salary Advance Breakdown</div>
                    <table className="w-full border-collapse border border-black text-center text-xs">
                        <thead>
                            <tr className="bg-[#b3d9ff]">
                                <th className="border border-black p-1">Type</th>
                                <th className="border border-black p-1">Amount</th>
                                <th className="border border-black p-1">Duration</th>
                                <th className="border border-black p-1">Paid Amount</th>
                                <th className="border border-black p-1">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 min-h-[20px]">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>


                {/* Totals */}
                <div className="flex border border-black mb-6 bg-gray-50 text-xs">
                    <div className="w-1/2 p-2 font-bold border-r border-black flex justify-between">
                        <span>TOTAL OUTSTANDING:</span>
                        <span className="text-red-700 text-sm">{totalFine} AED</span>
                    </div>
                    <div className="w-1/2 p-2 font-bold flex justify-between">
                        <span>NEXT SALARY DEDUCTION:</span>
                        <span className="text-sm">{(Number(fine.fineAmount) / (fine.payableDuration || 1)).toFixed(2)} AED</span>
                    </div>
                </div>

                <div className="mb-2 text-xs font-bold uppercase underline">Acknowledged By:</div>

                {/* Signatures */}
                <div className="flex border border-black h-28 text-center text-[10px]">
                    <div className="w-1/5 border-r border-black flex flex-col justify-between p-1">
                        <div className="uppercase font-bold pt-1">Employee</div>
                        <div className="border-t border-black border-dashed mt-auto pt-1 mb-1 mx-2">Signature</div>
                        <div className="text-gray-500">Date: ..../..../......</div>
                    </div>
                    <div className="w-1/5 border-r border-black flex flex-col justify-between p-1">
                        <div className="uppercase font-bold pt-1">HOD</div>
                        <div className="border-t border-black border-dashed mt-auto pt-1 mb-1 mx-2">Signature</div>
                        <div className="text-gray-500">Date: ..../..../......</div>
                    </div>
                    <div className="w-1/5 border-r border-black flex flex-col justify-between p-1">
                        <div className="uppercase font-bold pt-1">HR Officer</div>
                        <div className="border-t border-black border-dashed mt-auto pt-1 mb-1 mx-2">Signature</div>
                        <div className="text-gray-500">Date: ..../..../......</div>
                    </div>
                    <div className="w-1/5 border-r border-black flex flex-col justify-between p-1">
                        <div className="uppercase font-bold pt-1">Accounts</div>
                        <div className="border-t border-black border-dashed mt-auto pt-1 mb-1 mx-2">Signature</div>
                        <div className="text-gray-500">Date: ..../..../......</div>
                    </div>
                    <div className="w-1/5 flex flex-col justify-between p-1">
                        <div className="uppercase font-bold pt-1">Management</div>
                        <div className="border-t border-black border-dashed mt-auto pt-1 mb-1 mx-2">Signature</div>
                        <div className="text-gray-500">Date: ..../..../......</div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex justify-between items-end border-t-2 border-gray-300 pt-3 text-[10px] text-gray-500 leading-tight">
                    <div>
                        <p><strong>T:</strong> +971 4 340 99 88</p>
                        <p><strong>E:</strong> hello@vitsllc.com</p>
                        <p><strong>W:</strong> www.vitsllc.com</p>
                    </div>
                    <div className="text-center">
                        <p>Damascus Street, Qusais, Al Mansoor Building</p>
                        <p>4th Floor, Office 406, Dubai, UAE</p>
                        <p>PO Box: 18845</p>
                    </div>
                    <div>
                        <img src="/assets/images/iso.png" alt="ISO" className="h-8 object-contain" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                </div>
            </div>
        </>
    );
}
