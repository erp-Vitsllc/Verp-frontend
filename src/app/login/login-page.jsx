'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';
import { validateEmailOrUsername, validatePassword } from '@/utils/validation';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [agree, setAgree] = useState(true);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formErrors = {};

        const emailResult = validateEmailOrUsername(email);
        if (!emailResult.isValid) {
            formErrors.email = "Email/Username required & valid format";
        }

        // For login, only check if password is not empty (don't validate format)
        if (!password || password.trim() === '') {
            formErrors.password = "Password is required";
        }

        if (!agree) {
            formErrors.agree = "It must be checked to proceed with login.";
        }

        setErrors(formErrors);
        setServerError('');

        if (Object.keys(formErrors).length > 0) {
            return;
        }

        try {
            setLoading(true);
            setServerError('');

            const { data } = await axiosInstance.post('/Login', {
                email: email.trim(),
                password: password.trim(),
            });

            if (typeof window !== 'undefined') {
                // Store token and user data
                const userData = {
                    ...data?.user,
                    isAdmin: data?.isAdmin || false,
                    isAdministrator: data?.isAdministrator || false
                };
                localStorage.setItem('token', data?.token || '');
                localStorage.setItem('user', JSON.stringify(userData));
                // Also store for backward compatibility
                localStorage.setItem('employeeUser', JSON.stringify(userData));

                // Store permissions if available
                if (data?.permissions) {
                    localStorage.setItem('userPermissions', JSON.stringify(data.permissions));
                }

                // Store admin status
                if (data?.isAdmin !== undefined) {
                    localStorage.setItem('isAdmin', data.isAdmin.toString());
                }

                // Store token expiry info
                if (data?.expiresIn) {
                    localStorage.setItem('tokenExpiresIn', data.expiresIn);
                }
            }

            // Show success and redirect
            const redirectTo = searchParams.get('redirectTo') || '/dashboard';
            router.push(redirectTo);
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Login failed. Please try again.';
            setServerError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white overflow-hidden relative">
            {/* Left Side - Blue Diagonal Background with Icons */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-300 to-slate-500 justify-center items-center overflow-hidden">
                <svg
                    className="absolute inset-0 w-full h-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 1000 800"
                    style={{
                        clipPath: 'polygon(0 0, 100% 0, 60% 100%, 0 100%)',
                    }}
                >
                    <rect width="1000" height="800" fill="url(#grad)" />
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#93c5e0', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#64748b', stopOpacity: 1 }} />
                        </linearGradient>
                    </defs>
                </svg>

                <div className="relative z-10 flex flex-col justify-center items-center px-12 w-full">
                    {/* Welcome Text */}
                    <div className="text-center mb-16">
                        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">Welcome to VERP</h1>
                        <p className="text-base text-slate-200 font-light leading-relaxed">
                            Lorem Ipsum is simply dummy<br />
                            text of the printing
                        </p>
                    </div>

                    <div className="relative w-200 h-80 flex items-center justify-center">
                        <Image
                            src="/assets/auth/background-icons.png"
                            alt="VERP Features"
                            fill
                            priority
                            loading="eager"
                            sizes="(min-width: 1024px) 50vw, 100vw"
                            className="object-contain"
                        />
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-12 bg-white">
                <div className="w-full max-w-md">

                    {/* Logo */}
                    <div className="flex justify-center mb-12">
                        <Image
                            src="/assets/auth/logo.png"
                            alt="VIS Logo"
                            width={300}
                            height={140}
                            style={{ height: 'auto' }}
                        />
                    </div>

                    <h2 className="text-4xl font-bold text-gray-700 mb-12 text-center">
                        Member Login
                    </h2>

                    {/* FORM START */}
                    <form onSubmit={handleSubmit}>

                        {/* Email */}
                        <div className="mb-2">
                            <input
                                type="text"
                                placeholder="Email or Username"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`w-full px-5 py-3.5 rounded-lg text-sm transition focus:outline-none focus:ring-2 ${errors.email
                                    ? "bg-red-50 ring-red-400"
                                    : "bg-gray-100 focus:ring-blue-500"
                                    }`}
                            />
                            {errors.email && (
                                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="mb-2 relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password@123"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full px-5 py-3.5 rounded-lg text-sm transition focus:outline-none focus:ring-2 ${errors.password
                                    ? "bg-red-50 ring-red-400"
                                    : "bg-gray-100 focus:ring-blue-500"
                                    }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                👁
                            </button>
                            {errors.password && (
                                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                            )}
                        </div>

                        {/* Agree Checkbox */}
                        <div className="mb-6 flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={agree}
                                onChange={(e) => setAgree(e.target.checked)}
                                className="mt-1 w-4 h-4 accent-blue-500"
                            />
                            <label className="text-sm text-gray-600">
                                By logging in you agree to our{" "}
                                <a className="text-cyan-500 font-medium">Terms & Conditions</a>{" "}
                                and{" "}
                                <a className="text-cyan-500 font-medium">Privacy Policy</a>.
                            </label>
                        </div>
                        {errors.agree && (
                            <p className="text-red-500 text-xs -mt-4 mb-4">{errors.agree}</p>
                        )}

                        {serverError && (
                            <div className="mb-4 text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-lg py-2 px-3">
                                {serverError}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                            <a className="text-blue-600 text-sm hover:underline font-medium">
                                Forgot password?
                            </a>

                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-8 py-3 rounded-full font-semibold shadow-md transition"
                            >
                                {loading ? 'Logging in...' : 'Login →'}
                            </button>
                        </div>

                    </form>
                    {/* FORM END */}
                </div>
            </div>
        </div>
    );
}
