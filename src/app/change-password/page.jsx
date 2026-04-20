'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axiosInstance from '@/utils/axios';

function ChangePasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (!token) {
            setError('Reset token is missing or invalid.');
            return;
        }
        if (!password || !confirmPassword) {
            setError('Please fill both password fields.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Password and confirm password do not match.');
            return;
        }

        try {
            setSubmitting(true);
            const res = await axiosInstance.post('/Login/complete-password-reset', {
                token,
                password,
                confirmPassword,
            });
            setMessage(res?.data?.message || 'Password changed successfully.');
            setTimeout(() => {
                router.push('/login');
            }, 1200);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to change password.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F2F6F9] flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl p-6">
                <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Set your new password to continue login.
                </p>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter new password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Confirm new password"
                        />
                    </div>

                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    {message ? <p className="text-sm text-green-700">{message}</p> : null}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                        {submitting ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ChangePasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#F2F6F9] flex items-center justify-center px-4">
                    <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl p-6">
                        <p className="text-sm text-gray-500">Loading...</p>
                    </div>
                </div>
            }
        >
            <ChangePasswordContent />
        </Suspense>
    );
}

