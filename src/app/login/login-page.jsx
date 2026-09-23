'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import axiosInstance, { resetSessionExpiryHandled, resetSidebarPollingState } from '@/utils/axios';
import { touchActivity } from '@/utils/authSession';
import { validateEmailOrUsername, validatePassword } from '@/utils/validation';
import {
    isLocationRequiredError,
    promptSystemLocation,
    punchLocationPayload,
} from '@/utils/dashboardPunchMeta';
import { refreshWebPublicIp, webDevicePayload } from '@/utils/webLoginDevice';
import LocationTurnOnModal from '@/components/LocationTurnOnModal';

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
    const [otpToken, setOtpToken] = useState('');
    const [otp, setOtp] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [otpMessage, setOtpMessage] = useState('');
    const [locationModalOpen, setLocationModalOpen] = useState(false);
    const [locationBusy, setLocationBusy] = useState(false);
    const [locationError, setLocationError] = useState('');
    const submittingRef = useRef(false);

    const persistSession = (data) => {
        if (typeof window === 'undefined') return;
        const userData = {
            ...data?.user,
            isSystemSuperUser:
                data?.user?.isSystemSuperUser === true ||
                data?.isSystemSuperUser === true,
            isAdmin: data?.user?.isAdmin === true || data?.isAdmin === true,
            isAdministrator:
                data?.user?.isAdministrator === true ||
                data?.isAdministrator === true,
        };
        localStorage.setItem('token', data?.token || '');
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('employeeUser', JSON.stringify(userData));
        if (data?.permissions) {
            localStorage.setItem('userPermissions', JSON.stringify(data.permissions));
        }
        if (data?.isAdmin !== undefined) {
            localStorage.setItem('isAdmin', data.isAdmin.toString());
        }
        touchActivity();
        resetSessionExpiryHandled();
        resetSidebarPollingState();
    };

    const goAfterLogin = () => {
        let redirectTo = searchParams.get('redirectTo') || '/dashboard';
        if (redirectTo.startsWith('/login') || redirectTo === '/login') {
            redirectTo = '/dashboard';
        }
        router.push(redirectTo);
    };

    const finishIfLoggedIn = (data) => {
        if (!data?.token) return false;
        persistSession(data);
        goAfterLogin();
        return true;
    };

    const applyOtpChallenge = (data) => {
        setOtpToken(data.otpToken || '');
        setMaskedEmail(data.maskedEmail || '');
        setOtpMessage(data.message || `OTP sent to company email ${data.maskedEmail || ''}`);
        setOtp('');
        setServerError('');
    };

    const postPasswordLogin = async (coords) => {
        await refreshWebPublicIp();
        const { data } = await axiosInstance.post(
            '/Login',
            {
                email: email.trim().toLowerCase(),
                password: password.trim(),
                source: 'web',
                ...webDevicePayload(),
                ...(coords ? punchLocationPayload(coords) : {}),
            },
            { skipActionDedupe: true },
        );
        if (data?.needsOtp && data?.otpToken) {
            applyOtpChallenge(data);
            return;
        }
        if (!finishIfLoggedIn(data)) {
            throw new Error(data?.message || 'Login failed. Please try again.');
        }
    };

    const postOtpLogin = async (coords) => {
        await refreshWebPublicIp();
        const { data } = await axiosInstance.post(
            '/Login/otp',
            {
                otpToken,
                otp: String(otp || '').trim(),
                source: 'web',
                ...webDevicePayload(),
                ...punchLocationPayload(coords),
            },
            { skipActionDedupe: true },
        );
        if (!finishIfLoggedIn(data)) {
            throw new Error(data?.message || 'OTP check failed.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current || loading) return;

        if (otpToken) {
            if (!String(otp || '').trim()) {
                setServerError('Enter the OTP sent to your company email.');
                return;
            }
            const locationPromise = promptSystemLocation().catch(() => null);
            try {
                submittingRef.current = true;
                setLoading(true);
                setServerError('');
                const coords = await locationPromise;
                if (!coords) {
                    setLocationError('');
                    setLocationModalOpen(true);
                    return;
                }
                await postOtpLogin(coords);
            } catch (err) {
                if (err?.silent || err?.code === 'ACTION_DEDUPED') return;
                setServerError(
                    err.response?.data?.message ||
                    err.message ||
                    'OTP check failed. Please try again.',
                );
            } finally {
                submittingRef.current = false;
                setLoading(false);
            }
            return;
        }

        const formErrors = {};

        const emailResult = validateEmailOrUsername(email);
        if (!emailResult.isValid) {
            formErrors.email = "Email/Username required & valid format";
        }

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

        const locationPromise = promptSystemLocation().catch(() => null);
        try {
            submittingRef.current = true;
            setLoading(true);
            setServerError('');
            try {
                await postPasswordLogin(null);
            } catch (err) {
                if (!isLocationRequiredError(err)) throw err;
                const coords = await locationPromise;
                if (!coords) {
                    setLocationError('');
                    setLocationModalOpen(true);
                    return;
                }
                await postPasswordLogin(coords);
            }
        } catch (err) {
            if (err?.silent || err?.code === 'ACTION_DEDUPED') {
                return;
            }
            setServerError(
                err.response?.data?.message ||
                err.message ||
                'Login failed. Please try again.',
            );
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    };

    const handleTurnOnLocation = async () => {
        if (locationBusy) return;
        setLocationBusy(true);
        setLocationError('');
        try {
            const coords = await promptSystemLocation();
            if (otpToken) {
                await postOtpLogin(coords);
            } else {
                await postPasswordLogin(coords);
            }
            setLocationModalOpen(false);
        } catch (err) {
            if (isLocationRequiredError(err) || !err.response) {
                setLocationError(err.message || 'Turn on location, allow access, then try again.');
                return;
            }
            setLocationModalOpen(false);
            setServerError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
        } finally {
            setLocationBusy(false);
        }
    };

    const handleResendOtp = async () => {
        if (!otpToken || loading) return;
        try {
            submittingRef.current = true;
            setLoading(true);
            setServerError('');
            const { data } = await axiosInstance.post(
                '/Login/otp/resend',
                { otpToken },
                { skipActionDedupe: true },
            );
            applyOtpChallenge(data);
        } catch (err) {
            setServerError(
                err.response?.data?.message ||
                err.message ||
                'Could not resend OTP.',
            );
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen lg:h-screen flex bg-white overflow-y-auto lg:overflow-hidden relative">
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
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-5 bg-white lg:overflow-y-auto h-auto lg:h-full">
                <div className="w-full max-w-md">

                    {/* Logo */}
                    <div className="flex justify-center mb-2">
                        <Image
                            src="/assets/auth/verp-logo-3.png"
                            alt="VIS Logo"
                            width={700}
                            height={280}
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

                        {otpToken ? (
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2">
                                    {otpMessage || `OTP sent to company email ${maskedEmail}`}
                                </p>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full px-5 py-3.5 rounded-lg text-sm bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={loading}
                                        className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
                                    >
                                        Resend OTP
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpToken('');
                                            setOtp('');
                                            setOtpMessage('');
                                            setMaskedEmail('');
                                            setServerError('');
                                        }}
                                        className="text-sm text-gray-500 hover:underline"
                                    >
                                        Back to login
                                    </button>
                                </div>
                            </div>
                        ) : null}

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
                                data-no-action-guard="true"
                                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-semibold shadow-md transition"
                            >
                                {loading ? 'Logging in...' : otpToken ? 'Verify →' : 'Login →'}
                            </button>
                        </div>

                    </form>
                    {/* FORM END */}
                </div>
            </div>
            <LocationTurnOnModal
                open={locationModalOpen}
                busy={locationBusy}
                error={locationError}
                onTurnOn={handleTurnOnLocation}
                onClose={() => {
                    if (locationBusy) return;
                    setLocationModalOpen(false);
                }}
            />
        </div>
    );
}
