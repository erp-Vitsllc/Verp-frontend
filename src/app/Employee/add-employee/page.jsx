'use client';

import { useState, useEffect } from 'react';
import PhoneInput from 'react-phone-input-2';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';

const NAME_REGEX = /^[A-Za-z\s]+$/;
const generateEmployeeId = () => Math.floor(10000 + Math.random() * 90000).toString();
const DEFAULT_PHONE_COUNTRY = 'ae';
const statusOptions = [
    { value: 'Probation', label: 'Probation' },
    { value: 'Permanent', label: 'Permanent' },
    { value: 'Temporary', label: 'Temporary' }
];
const designationOptions = [
    { value: 'manager', label: 'Manager' },
    { value: 'developer', label: 'Developer' },
    { value: 'hr-manager', label: 'HR Manager' }
];
const departmentOptions = [
    { value: 'admin', label: 'Administration' },
    { value: 'hr', label: 'Human Resources' },
    { value: 'it', label: 'IT' }
];
const countryOptions = [
    { value: 'uae', label: 'UAE' },
    { value: 'india', label: 'India' },
    { value: 'usa', label: 'USA' }
];
const stateOptions = [
    { value: 'state1', label: 'State 1' },
    { value: 'state2', label: 'State 2' }
];
const selectStyles = {
    control: (provided, state) => ({
        ...provided,
        borderRadius: '0.5rem',
        borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
        boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
        paddingLeft: '0.25rem',
        minHeight: '44px'
    }),
    valueContainer: (provided) => ({
        ...provided,
        paddingLeft: '0.25rem'
    })
};
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axios from '@/utils/axios';

export default function AddEmployee() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [showAddMoreDropdown, setShowAddMoreDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Step 1: Basic Details
    const [basicDetails, setBasicDetails] = useState({
        firstName: '',
        lastName: '',
        employeeId: '',
        department: '',
        designation: '',
        dateOfJoining: '',
        email: '',
        contactNumber: '',
        status: 'Probation',
        enablePortalAccess: false,
        password: ''
    });

    useEffect(() => {
        setBasicDetails(prev => prev.employeeId ? prev : { ...prev, employeeId: generateEmployeeId() });
    }, []);

    // Step 2: Salary Details
    const [salaryDetails, setSalaryDetails] = useState({
        monthlySalary: 1000,
        basic: 600,
        basicPercentage: 60,
        houseRentAllowance: 200,
        houseRentPercentage: 20,
        otherAllowance: 200,
        otherAllowancePercentage: 20,
        additionalAllowances: []
    });

    // Step 3: Personal Details
    const [personalDetails, setPersonalDetails] = useState({
        dateOfBirth: '',
        age: '', // For display only, not sent to backend
        gender: '',
        nationality: '',
        fathersName: '',
        addressLine1: '',
        addressLine2: '',
        country: '',
        state: '',
        city: '',
        postalCode: ''
    });

    const steps = [
        { number: 1, title: 'Basic Details', description: 'Employee Details & Role Assignment' },
        { number: 2, title: 'Salary Details', description: 'Compensation & Benefits Setup' },
        { number: 3, title: 'Personal Details', description: 'Compensation & Benefits Setup' }
    ];

    const handleBasicDetailsChange = (field, value) => {
        setBasicDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleNameInput = (field, value) => {
        const sanitized = value.replace(/[^A-Za-z\s]/g, '');
        handleBasicDetailsChange(field, sanitized);
    };

    const handlePhoneChange = (value) => {
        handleBasicDetailsChange('contactNumber', value);
    };

    const handleDateChange = (target, field, date) => {
        const formatted = date ? date.toISOString().split('T')[0] : '';
        if (target === 'basic') {
            handleBasicDetailsChange(field, formatted);
        } else {
            handlePersonalDetailsChange(field, formatted);
        }
    };

    const handleSalaryChange = (field, value) => {
        setSalaryDetails(prev => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate percentages and amounts
            if (field === 'monthlySalary') {
                updated.basic = Math.round((updated.monthlySalary * updated.basicPercentage) / 100);
                updated.houseRentAllowance = Math.round((updated.monthlySalary * updated.houseRentPercentage) / 100);
                updated.otherAllowance = Math.round((updated.monthlySalary * updated.otherAllowancePercentage) / 100);
            } else if (field === 'basicPercentage') {
                updated.basic = Math.round((updated.monthlySalary * value) / 100);
            } else if (field === 'houseRentPercentage') {
                updated.houseRentAllowance = Math.round((updated.monthlySalary * value) / 100);
            } else if (field === 'otherAllowancePercentage') {
                updated.otherAllowance = Math.round((updated.monthlySalary * value) / 100);
            }

            return updated;
        });
    };

    const handlePersonalDetailsChange = (field, value) => {
        setPersonalDetails(prev => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate age from date of birth
            if (field === 'dateOfBirth' && value) {
                const birthDate = new Date(value);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                updated.age = age.toString();
            }

            return updated;
        });
    };

    const calculateTotal = () => {
        const additionalTotal = salaryDetails.additionalAllowances.reduce((sum, item) => sum + item.amount, 0);
        return salaryDetails.basic + salaryDetails.houseRentAllowance + salaryDetails.otherAllowance + additionalTotal;
    };

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSaveAndContinue = async () => {
        if (currentStep < 3) {
            handleNext();
        } else {
            // Final save - submit all data to backend
            try {
                setLoading(true);
                setError('');

                // Validate required fields before submitting
                if (!basicDetails.firstName || !basicDetails.lastName || !basicDetails.employeeId ||
                    !basicDetails.department || !basicDetails.designation ||
                    !basicDetails.dateOfJoining || !basicDetails.email || !basicDetails.contactNumber) {
                    setError('Please fill all required fields in Basic Details section');
                    setLoading(false);
                    setCurrentStep(1); // Go back to step 1
                    return;
                }

                if (!NAME_REGEX.test(basicDetails.firstName.trim()) || !NAME_REGEX.test(basicDetails.lastName.trim())) {
                    setError('First Name and Last Name can only contain letters.');
                    setLoading(false);
                    setCurrentStep(1);
                    return;
                }

                const contactDigits = (basicDetails.contactNumber || '').replace(/\D/g, '');
                if (!contactDigits || contactDigits.length < 5) {
                    setError('Contact Number must be at least 5 digits.');
                    setLoading(false);
                    setCurrentStep(1);
                    return;
                }

                // Validate personal details required fields
                if (!personalDetails.gender) {
                    setError('Please fill all required fields in Personal Details section');
                    setLoading(false);
                    setCurrentStep(3); // Go back to step 3
                    return;
                }

                // Validate password if portal access is enabled
                if (basicDetails.enablePortalAccess && !basicDetails.password) {
                    setError('Password is required when Portal Access is enabled');
                    setLoading(false);
                    setCurrentStep(1);
                    return;
                }

                // Remove age from personalDetails - backend will calculate it from dateOfBirth
                const { age, ...personalDetailsWithoutAge } = personalDetails;

                // Clean up data: ensure no null values, set defaults for optional fields
                const cleanData = (obj) => {
                    const cleaned = {};
                    for (const [key, value] of Object.entries(obj)) {
                        // Skip password if portal access is disabled
                        if (key === 'password' && !obj.enablePortalAccess) {
                            continue;
                        }

                        // Skip age - backend calculates it
                        if (key === 'age') {
                            continue;
                        }

                        if (value === '' || value === null || value === undefined) {
                            // For date fields, set to null if empty (optional dates)
                            if (key.includes('date') || key.includes('Date') || key.includes('Exp')) {
                                cleaned[key] = null;
                            }
                            // For string fields, set to empty string (not null)
                            else if (typeof value === 'string') {
                                cleaned[key] = '';
                            }
                            // For number fields, set to 0
                            else if (typeof value === 'number') {
                                cleaned[key] = 0;
                            }
                            // For boolean fields, set to false
                            else if (typeof value === 'boolean') {
                                cleaned[key] = false;
                            }
                            // For arrays, set to empty array
                            else if (Array.isArray(value)) {
                                cleaned[key] = [];
                            }
                            else {
                                cleaned[key] = value;
                            }
                        } else {
                            cleaned[key] = value;
                        }
                    }
                    return cleaned;
                };

                const formattedContactNumber = basicDetails.contactNumber
                    ? (basicDetails.contactNumber.startsWith('+')
                        ? basicDetails.contactNumber
                        : `+${basicDetails.contactNumber}`)
                    : '';

                const employeeData = cleanData({
                    ...basicDetails,
                    contactNumber: formattedContactNumber,
                    role: basicDetails.designation || '', // Use designation as role if role is not provided
                    ...salaryDetails,
                    ...personalDetailsWithoutAge, // Don't send age, backend calculates it
                });

                console.log('Sending employee data:', employeeData);

                const response = await axios.post('/Employee', employeeData);

                console.log('Employee added successfully:', response.data);

                // Success - redirect to employee list
                router.push('/Employee');
            } catch (err) {
                console.error('Full error object:', err);
                let errorMessage = 'Error connecting to server.';

                // Check for network errors
                if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('CONNECTION_REFUSED')) {
                    errorMessage = 'Backend server is not running. Please start the server:\n1. Open terminal\n2. cd server\n3. npm start';
                } else if (err.message) {
                    errorMessage = err.message;
                } else if (err.response?.data?.message) {
                    errorMessage = err.response.data.message;
                    // Show missing fields if provided
                    if (err.response.data.missingFields) {
                        const missing = Object.entries(err.response.data.missingFields)
                            .filter(([_, isMissing]) => isMissing)
                            .map(([field]) => field);
                        if (missing.length > 0) {
                            errorMessage += `\nMissing fields: ${missing.join(', ')}`;
                        }
                    }
                } else if (err.response?.data) {
                    errorMessage = JSON.stringify(err.response.data);
                }

                setError(errorMessage);
                console.error('Error adding employee:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Navbar />
                <div className="p-8 bg-gray-50">
                    <h1 className="text-3xl font-bold text-gray-800 mb-8">Add Employee</h1>

                    <div className="flex gap-8">
                        {/* Progress Steps */}
                        <div className="w-64 flex-shrink-0">
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                {steps.map((step, index) => (
                                    <div key={step.number} className="relative">
                                        {index < steps.length - 1 && (
                                            <div className={`absolute left-4 top-12 w-0.5 h-16 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                                                }`}></div>
                                        )}
                                        <div className="flex items-start gap-4 pb-8">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${currentStep === step.number
                                                ? 'bg-blue-500 text-white'
                                                : currentStep > step.number
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-200 text-gray-500'
                                                }`}>
                                                {step.number}
                                            </div>
                                            <div className="flex-1">
                                                <div className={`font-semibold ${currentStep === step.number ? 'text-blue-600' : 'text-gray-700'
                                                    }`}>
                                                    {step.number} {step.title}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">{step.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form Content */}
                        <div className="flex-1 bg-white rounded-lg shadow-sm p-8">
                            {/* Step 1: Basic Details */}
                            {currentStep === 1 && (
                                <div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                First Name
                                            </label>
                                            <input
                                                type="text"
                                                value={basicDetails.firstName}
                                                onChange={(e) => handleNameInput('firstName', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="First Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Last Name
                                            </label>
                                            <input
                                                type="text"
                                                value={basicDetails.lastName}
                                                onChange={(e) => handleNameInput('lastName', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Last Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Employee ID
                                            </label>
                                            <input
                                                type="text"
                                                value={basicDetails.employeeId}
                                                readOnly
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Auto-generated"
                                                title="Employee ID is generated automatically"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Date of Joining
                                            </label>
                                            <DatePicker
                                                selected={basicDetails.dateOfJoining ? new Date(basicDetails.dateOfJoining) : null}
                                                onChange={(date) => handleDateChange('basic', 'dateOfJoining', date)}
                                                dateFormat="yyyy-MM-dd"
                                                className="w-full px-5 py-2 border border-blue-200 rounded-xl bg-blue-50 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholderText="Select date"
                                                showYearDropdown
                                                dropdownMode="select"
                                                yearDropdownItemNumber={100}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                value={basicDetails.email}
                                                onChange={(e) => handleBasicDetailsChange('email', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Email"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Contact Number
                                            </label>
                                            <PhoneInput
                                                country={DEFAULT_PHONE_COUNTRY}
                                                value={basicDetails.contactNumber}
                                                onChange={handlePhoneChange}
                                                enableSearch
                                                inputStyle={{
                                                    width: '100%',
                                                    height: '42px',
                                                    borderRadius: '0.5rem',
                                                    borderColor: '#d1d5db'
                                                }}
                                                buttonStyle={{
                                                    borderTopLeftRadius: '0.5rem',
                                                    borderBottomLeftRadius: '0.5rem',
                                                    borderColor: '#d1d5db',
                                                    backgroundColor: '#fff'
                                                }}
                                                dropdownStyle={{ borderRadius: '0.5rem' }}
                                                placeholder="Contact Number"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Status
                                            </label>
                                            <Select
                                                instanceId="status-select"
                                                inputId="status-select-input"
                                                value={statusOptions.find(option => option.value === basicDetails.status)}
                                                onChange={(option) => handleBasicDetailsChange('status', option?.value || '')}
                                                options={statusOptions}
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Designation
                                            </label>
                                            <Select
                                                instanceId="designation-select"
                                                inputId="designation-select-input"
                                                value={designationOptions.find(option => option.value === basicDetails.designation) || null}
                                                onChange={(option) => handleBasicDetailsChange('designation', option?.value || '')}
                                                options={designationOptions}
                                                placeholder="Select Designation"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Department
                                            </label>
                                            <Select
                                                instanceId="department-select"
                                                inputId="department-select-input"
                                                value={departmentOptions.find(option => option.value === basicDetails.department) || null}
                                                onChange={(option) => handleBasicDetailsChange('department', option?.value || '')}
                                                options={departmentOptions}
                                                placeholder="Select Department"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={basicDetails.enablePortalAccess}
                                                onChange={(e) => handleBasicDetailsChange('enablePortalAccess', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Enable Portal Access</span>
                                        </label>
                                        {basicDetails.enablePortalAccess && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Password <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="password"
                                                    value={basicDetails.password}
                                                    onChange={(e) => handleBasicDetailsChange('password', e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Enter password for portal access"
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Salary Details */}
                            {currentStep === 2 && (
                                <div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Salary (Monthly)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                            <input
                                                type="number"
                                                value={salaryDetails.monthlySalary}
                                                onChange={(e) => handleSalaryChange('monthlySalary', parseFloat(e.target.value) || 0)}
                                                className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSalaryChange('monthlySalary', salaryDetails.monthlySalary + 100)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSalaryChange('monthlySalary', Math.max(0, salaryDetails.monthlySalary - 100))}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Earnings</h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Basic ({salaryDetails.basicPercentage}%)
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                    <input
                                                        type="number"
                                                        value={salaryDetails.basic}
                                                        readOnly
                                                        className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSalaryChange('basicPercentage', Math.min(100, salaryDetails.basicPercentage + 1))}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            ▲
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSalaryChange('basicPercentage', Math.max(0, salaryDetails.basicPercentage - 1))}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            ▼
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        House Rent Allowance
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={salaryDetails.houseRentPercentage}
                                                            onChange={(e) => handleSalaryChange('houseRentPercentage', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('houseRentPercentage', salaryDetails.houseRentPercentage + 1)}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('houseRentPercentage', Math.max(0, salaryDetails.houseRentPercentage - 1))}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Amount
                                                    </label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                        <input
                                                            type="number"
                                                            value={salaryDetails.houseRentAllowance}
                                                            readOnly
                                                            className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('houseRentAllowance', salaryDetails.houseRentAllowance + 100)}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('houseRentAllowance', Math.max(0, salaryDetails.houseRentAllowance - 100))}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Other Allowance
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={salaryDetails.otherAllowancePercentage}
                                                            onChange={(e) => handleSalaryChange('otherAllowancePercentage', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-4 pr-12 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('otherAllowancePercentage', salaryDetails.otherAllowancePercentage + 1)}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('otherAllowancePercentage', Math.max(0, salaryDetails.otherAllowancePercentage - 1))}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Amount
                                                    </label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                                                        <input
                                                            type="number"
                                                            value={salaryDetails.otherAllowance}
                                                            readOnly
                                                            className="w-full pl-16 pr-12 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('otherAllowance', salaryDetails.otherAllowance + 100)}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSalaryChange('otherAllowance', Math.max(0, salaryDetails.otherAllowance - 100))}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 relative">
                                            <button
                                                onClick={() => setShowAddMoreDropdown(!showAddMoreDropdown)}
                                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                                            >
                                                <span>+</span> Add More
                                            </button>
                                            {showAddMoreDropdown && (
                                                <div className="absolute left-0 top-8 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                                    <button
                                                        onClick={() => {
                                                            setSalaryDetails(prev => ({
                                                                ...prev,
                                                                additionalAllowances: [...prev.additionalAllowances, { type: 'Sim Allowance', amount: 0, percentage: 0 }]
                                                            }));
                                                            setShowAddMoreDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                                                    >
                                                        Sim Allowance
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSalaryDetails(prev => ({
                                                                ...prev,
                                                                additionalAllowances: [...prev.additionalAllowances, { type: 'Fuel Allowance', amount: 0, percentage: 0 }]
                                                            }));
                                                            setShowAddMoreDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
                                                    >
                                                        Fuel Allowance
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 pt-6 border-t">
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-gray-800">
                                                    Total AED {calculateTotal().toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Personal Details */}
                            {currentStep === 3 && (
                                <div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Date of Birth
                                            </label>
                                            <DatePicker
                                                selected={personalDetails.dateOfBirth ? new Date(personalDetails.dateOfBirth) : null}
                                                onChange={(date) => handleDateChange('personal', 'dateOfBirth', date)}
                                                dateFormat="yyyy-MM-dd"
                                                className="w-full px-5 py-2 border border-blue-200 rounded-xl bg-blue-50 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholderText="Select date"
                                                maxDate={new Date()}
                                                showYearDropdown
                                                dropdownMode="select"
                                                yearDropdownItemNumber={100}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Age (Autofill)
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.age}
                                                readOnly
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                                placeholder="Age"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Gender <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={personalDetails.gender}
                                                onChange={(e) => handlePersonalDetailsChange('gender', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Nationality
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.nationality}
                                                onChange={(e) => handlePersonalDetailsChange('nationality', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nationality"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fathers Name
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.fathersName}
                                                onChange={(e) => handlePersonalDetailsChange('fathersName', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Fathers Name"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Address Line 1
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.addressLine1}
                                                onChange={(e) => handlePersonalDetailsChange('addressLine1', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Address Line 1"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Address Line 2
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.addressLine2}
                                                onChange={(e) => handlePersonalDetailsChange('addressLine2', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Address Line 2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Country
                                            </label>
                                            <Select
                                                instanceId="country-select"
                                                inputId="country-select-input"
                                                value={countryOptions.find(option => option.value === personalDetails.country) || null}
                                                onChange={(option) => handlePersonalDetailsChange('country', option?.value || '')}
                                                options={countryOptions}
                                                placeholder="Select Country"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                State
                                            </label>
                                            <Select
                                                instanceId="state-select"
                                                inputId="state-select-input"
                                                value={stateOptions.find(option => option.value === personalDetails.state) || null}
                                                onChange={(option) => handlePersonalDetailsChange('state', option?.value || '')}
                                                options={stateOptions}
                                                placeholder="Select State"
                                                styles={selectStyles}
                                                className="text-sm"
                                                classNamePrefix="rs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                City
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.city}
                                                onChange={(e) => handlePersonalDetailsChange('city', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="City"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Postal Code
                                            </label>
                                            <input
                                                type="text"
                                                value={personalDetails.postalCode}
                                                onChange={(e) => handlePersonalDetailsChange('postalCode', e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Postal Code"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-8 flex items-center justify-between pt-6 border-t">
                                <div>
                                    {currentStep === 1 ? (
                                        <button
                                            onClick={() => router.push('/Employee')}
                                            disabled={loading}
                                            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleBack}
                                            disabled={loading}
                                            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
                                        >
                                            Back
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleSaveAndContinue}
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Saving...' : currentStep === 3 ? 'Save' : 'Save and Continue'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

