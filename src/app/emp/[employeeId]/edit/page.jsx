// 'use client';

// import { useEffect, useState } from 'react';
// import { useParams, useRouter } from 'next/navigation';
// import Sidebar from '@/components/Sidebar';
// import Navbar from '@/components/Navbar';
// import axiosInstance from '@/utils/axios';

// const formatDateForInput = (dateValue) => {
//     if (!dateValue) return '';
//     const date = new Date(dateValue);
//     if (Number.isNaN(date.getTime())) return '';
//     return date.toISOString().split('T')[0];
// };

// const calculateAge = (dateString) => {
//     if (!dateString) return '';
//     const birthDate = new Date(dateString);
//     if (Number.isNaN(birthDate.getTime())) return '';
//     const today = new Date();
//     let age = today.getFullYear() - birthDate.getFullYear();
//     const monthDiff = today.getMonth() - birthDate.getMonth();
//     if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
//         age--;
//     }
//     return age.toString();
// };

// export default function EditEmployeePage() {
//     const router = useRouter();
//     const params = useParams();
//     const employeeId = params?.employeeId;

//     const [currentStep, setCurrentStep] = useState(1);
//     const [showAddMoreDropdown, setShowAddMoreDropdown] = useState(false);
//     const [initialLoading, setInitialLoading] = useState(true);
//     const [saving, setSaving] = useState(false);
//     const [error, setError] = useState('');
//     const [initialPortalAccess, setInitialPortalAccess] = useState(false);

//     const [basicDetails, setBasicDetails] = useState({
//         firstName: '',
//         lastName: '',
//         employeeId: '',
//         role: '',
//         department: '',
//         designation: '',
//         status: 'Active',
//         dateOfJoining: '',
//         workEmail: '',
//         mobileNumber: '',
//         gender: '',
//         workLocation: '',
//         enablePortalAccess: false,
//         password: ''
//     });

//     const [salaryDetails, setSalaryDetails] = useState({
//         monthlySalary: 0,
//         basic: 0,
//         basicPercentage: 60,
//         houseRentAllowance: 0,
//         houseRentPercentage: 20,
//         otherAllowance: 0,
//         otherAllowancePercentage: 20,
//         additionalAllowances: []
//     });

//     const [personalDetails, setPersonalDetails] = useState({
//         dateOfBirth: '',
//         age: '',
//         fathersName: '',
//         addressLine1: '',
//         addressLine2: '',
//         country: '',
//         state: '',
//         city: '',
//         postalCode: '',
//         passportExp: '',
//         eidExp: '',
//         medExp: ''
//     });

//     const steps = [
//         { number: 1, title: 'Basic Details', description: 'Employee Details & Role Assignment' },
//         { number: 2, title: 'Salary Details', description: 'Compensation & Benefits Setup' },
//         { number: 3, title: 'Personal Details', description: 'Compensation & Benefits Setup' }
//     ];

//     useEffect(() => {
//         const loadEmployee = async () => {
//             try {
//                 setInitialLoading(true);
//                 setError('');
//                 const response = await axiosInstance.get(`/Employee/${employeeId}`);
//                 const employee = response.data?.employee || response.data;

//                 setBasicDetails({
//                     firstName: employee.firstName || '',
//                     lastName: employee.lastName || '',
//                     employeeId: employee.employeeId || '',
//                     role: employee.role || '',
//                     department: employee.department || '',
//                     designation: employee.designation || '',
//                     status: employee.status || 'Active',
//                     dateOfJoining: formatDateForInput(employee.dateOfJoining),
//                     workEmail: employee.workEmail || '',
//                     mobileNumber: employee.mobileNumber || '',
//                     gender: employee.gender || '',
//                     workLocation: employee.workLocation || '',
//                     enablePortalAccess: employee.enablePortalAccess || false,
//                     password: ''
//                 });
//                 setInitialPortalAccess(!!employee.enablePortalAccess);

//                 setSalaryDetails({
//                     monthlySalary: employee.monthlySalary || 0,
//                     basic: employee.basic || 0,
//                     basicPercentage: employee.basicPercentage ?? 60,
//                     houseRentAllowance: employee.houseRentAllowance || 0,
//                     houseRentPercentage: employee.houseRentPercentage ?? 20,
//                     otherAllowance: employee.otherAllowance || 0,
//                     otherAllowancePercentage: employee.otherAllowancePercentage ?? 20,
//                     additionalAllowances: employee.additionalAllowances || []
//                 });

//                 setPersonalDetails({
//                     dateOfBirth: formatDateForInput(employee.dateOfBirth),
//                     age: employee.age ? employee.age.toString() : calculateAge(employee.dateOfBirth),
//                     fathersName: employee.fathersName || '',
//                     addressLine1: employee.addressLine1 || '',
//                     addressLine2: employee.addressLine2 || '',
//                     country: employee.country || '',
//                     state: employee.state || '',
//                     city: employee.city || '',
//                     postalCode: employee.postalCode || '',
//                     passportExp: formatDateForInput(employee.passportExp),
//                     eidExp: formatDateForInput(employee.eidExp),
//                     medExp: formatDateForInput(employee.medExp)
//                 });
//             } catch (err) {
//                 console.error('Error loading employee:', err);
//                 setError(err.message || 'Unable to load employee details');
//             } finally {
//                 setInitialLoading(false);
//             }
//         };

//         if (employeeId) {
//             loadEmployee();
//         }
//     }, [employeeId]);

//     const handleBasicDetailsChange = (field, value) => {
//         setBasicDetails(prev => ({ ...prev, [field]: value }));
//     };

//     const handleSalaryChange = (field, value) => {
//         setSalaryDetails(prev => {
//             const updated = { ...prev, [field]: value };

//             if (field === 'monthlySalary') {
//                 updated.basic = Math.round((updated.monthlySalary * updated.basicPercentage) / 100);
//                 updated.houseRentAllowance = Math.round((updated.monthlySalary * updated.houseRentPercentage) / 100);
//                 updated.otherAllowance = Math.round((updated.monthlySalary * updated.otherAllowancePercentage) / 100);
//             } else if (field === 'basicPercentage') {
//                 updated.basic = Math.round((updated.monthlySalary * value) / 100);
//             } else if (field === 'houseRentPercentage') {
//                 updated.houseRentAllowance = Math.round((updated.monthlySalary * value) / 100);
//             } else if (field === 'otherAllowancePercentage') {
//                 updated.otherAllowance = Math.round((updated.monthlySalary * value) / 100);
//             }

//             return updated;
//         });
//     };

//     const handlePersonalDetailsChange = (field, value) => {
//         setPersonalDetails(prev => {
//             const updated = { ...prev, [field]: value };
//             if (field === 'dateOfBirth') {
//                 updated.age = calculateAge(value);
//             }
//             return updated;
//         });
//     };

//     const calculateTotal = () => {
//         const additionalTotal = salaryDetails.additionalAllowances.reduce((sum, item) => sum + (item.amount || 0), 0);
//         return salaryDetails.basic + salaryDetails.houseRentAllowance + salaryDetails.otherAllowance + additionalTotal;
//     };

//     const handleNext = () => {
//         if (currentStep < 3) {
//             setCurrentStep(currentStep + 1);
//         }
//     };

//     const handleBack = () => {
//         if (currentStep > 1) {
//             setCurrentStep(currentStep - 1);
//         }
//     };

//     const handleSaveAndContinue = async () => {
//         if (currentStep < 3) {
//             handleNext();
//         } else {
//             try {
//                 setSaving(true);
//                 setError('');

//                 if (!basicDetails.firstName || !basicDetails.lastName || !basicDetails.employeeId ||
//                     !basicDetails.role || !basicDetails.department || !basicDetails.designation ||
//                     !basicDetails.dateOfJoining || !basicDetails.workEmail || !basicDetails.mobileNumber ||
//                     !basicDetails.gender || !basicDetails.workLocation || !basicDetails.status) {
//                     setError('Please fill all required fields in Basic Details section');
//                     setSaving(false);
//                     setCurrentStep(1);
//                     return;
//                 }

//                 const isNewPortalAccess = basicDetails.enablePortalAccess && !initialPortalAccess;
//                 if (isNewPortalAccess && !basicDetails.password) {
//                     setError('Password is required when enabling Portal Access');
//                     setSaving(false);
//                     setCurrentStep(1);
//                     return;
//                 }

//                 const { age, ...personalDetailsWithoutAge } = personalDetails;

//                 const cleanData = (obj) => {
//                     const cleaned = {};
//                     for (const [key, value] of Object.entries(obj)) {
//                         if (key === 'password') {
//                             if (!obj.enablePortalAccess || !obj.password) continue;
//                         }
//                         if (key === 'age') continue;

//                         if (value === '' || value === null || value === undefined) {
//                             if (key.includes('date') || key.includes('Date') || key.includes('Exp')) {
//                                 cleaned[key] = null;
//                             } else if (typeof value === 'string') {
//                                 cleaned[key] = '';
//                             } else if (typeof value === 'number') {
//                                 cleaned[key] = 0;
//                             } else if (typeof value === 'boolean') {
//                                 cleaned[key] = false;
//                             } else if (Array.isArray(value)) {
//                                 cleaned[key] = [];
//                             } else {
//                                 cleaned[key] = value;
//                             }
//                         } else {
//                             cleaned[key] = value;
//                         }
//                     }
//                     return cleaned;
//                 };

//                 const employeeData = cleanData({
//                     ...basicDetails,
//                     ...salaryDetails,
//                     ...personalDetailsWithoutAge,
//                 });

//                 await axiosInstance.put(`/Employee/${employeeId}`, employeeData);
//                 router.push(`/Employee/${employeeId}`);
//             } catch (err) {
//                 console.error('Error updating employee:', err);
//                 let errorMessage = err.response?.data?.message || err.message || 'Failed to update employee';
//                 if (err.response?.data?.missingFields) {
//                     const missing = Object.entries(err.response.data.missingFields)
//                         .filter(([_, isMissing]) => isMissing)
//                         .map(([field]) => field);
//                     if (missing.length > 0) {
//                         errorMessage += `\nMissing fields: ${missing.join(', ')}`;
//                     }
//                 }
//                 setError(errorMessage);
//             } finally {
//                 setSaving(false);
//             }
//         }
//     };

//     if (initialLoading) {
//         return (
//             <div className="flex min-h-screen bg-gray-50">
//                 <Sidebar />
//                 <div className="flex-1 flex flex-col">
//                     <Navbar />
//                     <div className="p-8">
//                         <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">Loading employee data...</div>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="flex min-h-screen bg-gray-50">
//             <Sidebar />
//             <div className="flex-1 flex flex-col">
//                 <Navbar />
//                 <div className="p-8 bg-gray-50">
//                     <div className="flex items-center justify-between mb-8">
//                         <div>
//                             <button
//                                 onClick={() => router.back()}
//                                 className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
//                             >
//                                 ← Back
//                             </button>
//                             <h1 className="text-3xl font-bold text-gray-800">Edit Employee</h1>
//                             <p className="text-gray-500 mt-1">Update and review employee information</p>
//                         </div>
//                     </div>

//                     <div className="flex gap-8">
//                         <div className="w-64 flex-shrink-0">
//                             <div className="bg-white rounded-lg shadow-sm p-6">
//                                 {steps.map((step, index) => (
//                                     <div key={step.number} className="relative">
//                                         {index < steps.length - 1 && (
//                                             <div className={`absolute left-4 top-12 w-0.5 h-16 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`}></div>
//                                         )}
//                                         <div className="flex items-start gap-4 pb-8">
//                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${currentStep === step.number
//                                                 ? 'bg-blue-500 text-white'
//                                                 : currentStep > step.number
//                                                     ? 'bg-green-500 text-white'
//                                                     : 'bg-gray-200 text-gray-500'
//                                                 }`}>
//                                                 {step.number}
//                                             </div>
//                                             <div className="flex-1">
//                                                 <div className={`font-semibold ${currentStep === step.number ? 'text-blue-600' : 'text-gray-700'}`}>
//                                                     {step.number} {step.title}
//                                                 </div>
//                                                 <div className="text-xs text-gray-500 mt-1">{step.description}</div>
//                                             </div>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         </div>

//                         <div className="flex-1 bg-white rounded-lg shadow-sm p-8">
//                             {currentStep === 1 && (
//                                 <div>
//                                     <div className="grid grid-cols-2 gap-6">
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
//                                             <input
//                                                 type="text"
//                                                 value={basicDetails.firstName}
//                                                 onChange={(e) => handleBasicDetailsChange('firstName', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="First Name"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
//                                             <input
//                                                 type="text"
//                                                 value={basicDetails.lastName}
//                                                 onChange={(e) => handleBasicDetailsChange('lastName', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Last Name"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
//                                             <input
//                                                 type="text"
//                                                 value={basicDetails.employeeId}
//                                                 onChange={(e) => handleBasicDetailsChange('employeeId', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Employee ID"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
//                                             <input
//                                                 type="date"
//                                                 value={basicDetails.dateOfJoining}
//                                                 onChange={(e) => handleBasicDetailsChange('dateOfJoining', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Work Email</label>
//                                             <input
//                                                 type="email"
//                                                 value={basicDetails.workEmail}
//                                                 onChange={(e) => handleBasicDetailsChange('workEmail', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Work Email"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
//                                             <input
//                                                 type="tel"
//                                                 value={basicDetails.mobileNumber}
//                                                 onChange={(e) => handleBasicDetailsChange('mobileNumber', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Mobile Number"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
//                                             <select
//                                                 value={basicDetails.gender}
//                                                 onChange={(e) => handleBasicDetailsChange('gender', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="">Select Gender</option>
//                                                 <option value="male">Male</option>
//                                                 <option value="female">Female</option>
//                                                 <option value="other">Other</option>
//                                             </select>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Work Location</label>
//                                             <select
//                                                 value={basicDetails.workLocation}
//                                                 onChange={(e) => handleBasicDetailsChange('workLocation', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="">Select Work Location</option>
//                                                 <option value="location1">Location 1</option>
//                                                 <option value="location2">Location 2</option>
//                                             </select>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
//                                             <input
//                                                 type="text"
//                                                 value={basicDetails.role}
//                                                 onChange={(e) => handleBasicDetailsChange('role', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Role (e.g., HR Manager)"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
//                                             <select
//                                                 value={basicDetails.department}
//                                                 onChange={(e) => handleBasicDetailsChange('department', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="">Select Department</option>
//                                                 <option value="admin">Administration</option>
//                                                 <option value="hr">Human Resources</option>
//                                                 <option value="it">IT</option>
//                                             </select>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
//                                             <select
//                                                 value={basicDetails.designation}
//                                                 onChange={(e) => handleBasicDetailsChange('designation', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="">Select Designation</option>
//                                                 <option value="manager">Manager</option>
//                                                 <option value="developer">Developer</option>
//                                                 <option value="hr-manager">HR Manager</option>
//                                             </select>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
//                                             <select
//                                                 value={basicDetails.status}
//                                                 onChange={(e) => handleBasicDetailsChange('status', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="Active">Active</option>
//                                                 <option value="Notice">Notice</option>
//                                                 <option value="Inactive">Inactive</option>
//                                             </select>
//                                         </div>
//                                     </div>
//                                     <div className="mt-6 space-y-4">
//                                         <label className="flex items-center gap-2">
//                                             <input
//                                                 type="checkbox"
//                                                 checked={basicDetails.enablePortalAccess}
//                                                 onChange={(e) => handleBasicDetailsChange('enablePortalAccess', e.target.checked)}
//                                                 className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
//                                             />
//                                             <span className="text-sm font-medium text-gray-700">Enable Portal Access</span>
//                                         </label>
//                                         {basicDetails.enablePortalAccess && (
//                                             <div>
//                                                 {initialPortalAccess ? (
//                                                     <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
//                                                         Password already set. Employee can change it from their portal profile whenever needed.
//                                                     </div>
//                                                 ) : (
//                                                     <>
//                                                         <label className="block text-sm font-medium text-gray-700 mb-2">
//                                                             Password <span className="text-red-500">*</span>
//                                                         </label>
//                                                         <input
//                                                             type="password"
//                                                             value={basicDetails.password}
//                                                             onChange={(e) => handleBasicDetailsChange('password', e.target.value)}
//                                                             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                             placeholder="Enter password for portal access"
//                                                         />
//                                                     </>
//                                                 )}
//                                             </div>
//                                         )}
//                                     </div>
//                                 </div>
//                             )}

//                             {currentStep === 2 && (
//                                 <div>
//                                     <div className="mb-6">
//                                         <label className="block text-sm font-medium text-gray-700 mb-2">Salary (Monthly)</label>
//                                         <div className="relative">
//                                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
//                                             <input
//                                                 type="number"
//                                                 value={salaryDetails.monthlySalary}
//                                                 onChange={(e) => handleSalaryChange('monthlySalary', parseFloat(e.target.value) || 0)}
//                                                 className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             />
//                                             <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
//                                                 <button
//                                                     type="button"
//                                                     onClick={() => handleSalaryChange('monthlySalary', salaryDetails.monthlySalary + 100)}
//                                                     className="text-gray-400 hover:text-gray-600"
//                                                 >
//                                                     ▲
//                                                 </button>
//                                                 <button
//                                                     type="button"
//                                                     onClick={() => handleSalaryChange('monthlySalary', Math.max(0, salaryDetails.monthlySalary - 100))}
//                                                     className="text-gray-400 hover:text-gray-600"
//                                                 >
//                                                     ▼
//                                                 </button>
//                                             </div>
//                                         </div>
//                                     </div>

//                                     <div className="border-t pt-6">
//                                         <h3 className="text-lg font-semibold text-gray-800 mb-4">Earnings</h3>
//                                         <div className="space-y-4">
//                                             <div>
//                                                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                                                     Basic ({salaryDetails.basicPercentage}%)
//                                                 </label>
//                                                 <div className="relative">
//                                                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
//                                                     <input
//                                                         type="number"
//                                                         value={salaryDetails.basic}
//                                                         readOnly
//                                                         className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg bg-gray-50"
//                                                     />
//                                                     <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
//                                                         <button
//                                                             type="button"
//                                                             onClick={() => handleSalaryChange('basicPercentage', Math.min(100, salaryDetails.basicPercentage + 1))}
//                                                             className="text-gray-400 hover:text-gray-600"
//                                                         >
//                                                             ▲
//                                                         </button>
//                                                         <button
//                                                             type="button"
//                                                             onClick={() => handleSalaryChange('basicPercentage', Math.max(0, salaryDetails.basicPercentage - 1))}
//                                                             className="text-gray-400 hover:text-gray-600"
//                                                         >
//                                                             ▼
//                                                         </button>
//                                                     </div>
//                                                 </div>
//                                             </div>

//                                             <div className="grid grid-cols-2 gap-4">
//                                                 <div>
//                                                     <label className="block text-sm font-medium text-gray-700 mb-2">House Rent Allowance</label>
//                                                     <div className="relative">
//                                                         <input
//                                                             type="number"
//                                                             value={salaryDetails.houseRentPercentage}
//                                                             onChange={(e) => handleSalaryChange('houseRentPercentage', parseFloat(e.target.value) || 0)}
//                                                             className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                         />
//                                                         <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
//                                                     </div>
//                                                 </div>
//                                                 <div>
//                                                     <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
//                                                     <div className="relative">
//                                                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
//                                                         <input
//                                                             type="number"
//                                                             value={salaryDetails.houseRentAllowance}
//                                                             readOnly
//                                                             className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg bg-gray-50"
//                                                         />
//                                                     </div>
//                                                 </div>
//                                             </div>

//                                             <div className="grid grid-cols-2 gap-4">
//                                                 <div>
//                                                     <label className="block text-sm font-medium text-gray-700 mb-2">Other Allowance</label>
//                                                     <div className="relative">
//                                                         <input
//                                                             type="number"
//                                                             value={salaryDetails.otherAllowancePercentage}
//                                                             onChange={(e) => handleSalaryChange('otherAllowancePercentage', parseFloat(e.target.value) || 0)}
//                                                             className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                         />
//                                                         <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
//                                                     </div>
//                                                 </div>
//                                                 <div>
//                                                     <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
//                                                     <div className="relative">
//                                                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
//                                                         <input
//                                                             type="number"
//                                                             value={salaryDetails.otherAllowance}
//                                                             readOnly
//                                                             className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg bg-gray-50"
//                                                         />
//                                                     </div>
//                                                 </div>
//                                             </div>
//                                         </div>

//                                         <div className="mt-6 relative">
//                                             <button
//                                                 type="button"
//                                                 onClick={() => setShowAddMoreDropdown(!showAddMoreDropdown)}
//                                                 className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
//                                             >
//                                                 <span>+</span> Add More
//                                             </button>
//                                             {showAddMoreDropdown && (
//                                                 <div className="absolute left-0 top-8 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
//                                                     <button
//                                                         onClick={() => {
//                                                             setSalaryDetails(prev => ({
//                                                                 ...prev,
//                                                                 additionalAllowances: [...prev.additionalAllowances, { type: 'Sim Allowance', amount: 0, percentage: 0 }]
//                                                             }));
//                                                             setShowAddMoreDropdown(false);
//                                                         }}
//                                                         className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
//                                                     >
//                                                         Sim Allowance
//                                                     </button>
//                                                     <button
//                                                         onClick={() => {
//                                                             setSalaryDetails(prev => ({
//                                                                 ...prev,
//                                                                 additionalAllowances: [...prev.additionalAllowances, { type: 'Fuel Allowance', amount: 0, percentage: 0 }]
//                                                             }));
//                                                             setShowAddMoreDropdown(false);
//                                                         }}
//                                                         className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
//                                                     >
//                                                         Fuel Allowance
//                                                     </button>
//                                                 </div>
//                                             )}
//                                         </div>

//                                         <div className="mt-8 pt-6 border-t text-right">
//                                             <div className="text-2xl font-bold text-gray-800">
//                                                 Total AED {calculateTotal().toFixed(2)}
//                                             </div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             )}

//                             {currentStep === 3 && (
//                                 <div>
//                                     <div className="grid grid-cols-2 gap-6">
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
//                                             <div className="relative">
//                                                 <input
//                                                     type="date"
//                                                     value={personalDetails.dateOfBirth}
//                                                     onChange={(e) => handlePersonalDetailsChange('dateOfBirth', e.target.value)}
//                                                     className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 />
//                                             </div>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Age (Autofill)</label>
//                                             <input
//                                                 type="text"
//                                                 value={personalDetails.age}
//                                                 readOnly
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
//                                                 placeholder="Age"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Father's Name</label>
//                                             <input
//                                                 type="text"
//                                                 value={personalDetails.fathersName}
//                                                 onChange={(e) => handlePersonalDetailsChange('fathersName', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Father's Name"
//                                             />
//                                         </div>
//                                         <div className="col-span-2">
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1</label>
//                                             <input
//                                                 type="text"
//                                                 value={personalDetails.addressLine1}
//                                                 onChange={(e) => handlePersonalDetailsChange('addressLine1', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Address Line 1"
//                                             />
//                                         </div>
//                                         <div className="col-span-2">
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
//                                             <input
//                                                 type="text"
//                                                 value={personalDetails.addressLine2}
//                                                 onChange={(e) => handlePersonalDetailsChange('addressLine2', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Address Line 2"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
//                                             <select
//                                                 value={personalDetails.country}
//                                                 onChange={(e) => handlePersonalDetailsChange('country', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="">Select Country</option>
//                                                 <option value="uae">UAE</option>
//                                                 <option value="india">India</option>
//                                                 <option value="usa">USA</option>
//                                             </select>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
//                                             <select
//                                                 value={personalDetails.state}
//                                                 onChange={(e) => handlePersonalDetailsChange('state', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                             >
//                                                 <option value="">Select State</option>
//                                                 <option value="state1">State 1</option>
//                                                 <option value="state2">State 2</option>
//                                             </select>
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
//                                             <input
//                                                 type="text"
//                                                 value={personalDetails.city}
//                                                 onChange={(e) => handlePersonalDetailsChange('city', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="City"
//                                             />
//                                         </div>
//                                         <div>
//                                             <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
//                                             <input
//                                                 type="text"
//                                                 value={personalDetails.postalCode}
//                                                 onChange={(e) => handlePersonalDetailsChange('postalCode', e.target.value)}
//                                                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 placeholder="Postal Code"
//                                             />
//                                         </div>
//                                     </div>

//                                     <div className="mt-8 pt-6 border-t">
//                                         <h3 className="text-lg font-semibold text-gray-800 mb-4">Document Expiry Details</h3>
//                                         <div className="grid grid-cols-3 gap-6">
//                                             <div>
//                                                 <label className="block text-sm font-medium text-gray-700 mb-2">Passport Expiry</label>
//                                                 <input
//                                                     type="date"
//                                                     value={personalDetails.passportExp}
//                                                     onChange={(e) => handlePersonalDetailsChange('passportExp', e.target.value)}
//                                                     className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 />
//                                             </div>
//                                             <div>
//                                                 <label className="block text-sm font-medium text-gray-700 mb-2">EID Expiry</label>
//                                                 <input
//                                                     type="date"
//                                                     value={personalDetails.eidExp}
//                                                     onChange={(e) => handlePersonalDetailsChange('eidExp', e.target.value)}
//                                                     className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 />
//                                             </div>
//                                             <div>
//                                                 <label className="block text-sm font-medium text-gray-700 mb-2">Medical Expiry</label>
//                                                 <input
//                                                     type="date"
//                                                     value={personalDetails.medExp}
//                                                     onChange={(e) => handlePersonalDetailsChange('medExp', e.target.value)}
//                                                     className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                                                 />
//                                             </div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             )}

//                             {error && (
//                                 <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
//                                     {error}
//                                 </div>
//                             )}

//                             <div className="mt-8 flex items-center justify-between pt-6 border-t">
//                                 <div>
//                                     {currentStep === 1 ? (
//                                         <button
//                                             onClick={() => router.push(`/Employee/${employeeId}`)}
//                                             disabled={saving}
//                                             className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
//                                         >
//                                             Cancel
//                                         </button>
//                                     ) : (
//                                         <button
//                                             onClick={handleBack}
//                                             disabled={saving}
//                                             className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
//                                         >
//                                             Back
//                                         </button>
//                                     )}
//                                 </div>
//                                 <button
//                                     onClick={handleSaveAndContinue}
//                                     disabled={saving}
//                                     className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
//                                 >
//                                     {saving ? 'Saving...' : currentStep === 3 ? 'Save Changes' : 'Save and Continue'}
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

