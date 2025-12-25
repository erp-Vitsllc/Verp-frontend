/**
 * OPTIMIZED Employee List Page
 * Uses Server-Side Rendering (SSR) for initial data fetch
 * Falls back to client-side for interactivity
 */

import { cookies } from 'next/headers';
import { getEmployeesServer, getTokenFromCookies } from '@/lib/api-server';
import EmployeeListClient from './components/EmployeeListClient';

export const dynamic = 'force-dynamic'; // Always fetch fresh data
export const revalidate = 0; // No static generation

async function getInitialEmployees(searchParams) {
    try {
        const token = getTokenFromCookies(cookies());
        
        const params = {
            limit: parseInt(searchParams?.limit) || 10,
            page: parseInt(searchParams?.page) || 1,
            ...(searchParams?.search && { search: searchParams.search }),
            ...(searchParams?.department && { department: searchParams.department }),
            ...(searchParams?.designation && { designation: searchParams.designation }),
            ...(searchParams?.status && { status: searchParams.status }),
            ...(searchParams?.profileStatus && { profileStatus: searchParams.profileStatus }),
        };

        const data = await getEmployeesServer(params, token);
        return {
            employees: data?.employees || [],
            total: data?.pagination?.total || 0,
        };
    } catch (error) {
        console.error('Error fetching employees:', error);
        return {
            employees: [],
            total: 0,
        };
    }
}

export default async function EmployeePage({ searchParams }) {
    // Fetch initial data on the server
    const { employees, total } = await getInitialEmployees(searchParams);

    // Pass initial data to client component for hydration
    return (
        <EmployeeListClient 
            initialEmployees={employees} 
            initialTotal={total}
        />
    );
}




