/**
 * Server-side API utility for Next.js Server Components
 * This runs on the server, so we can directly call the backend API
 * without going through the client-side axios instance
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Server-side fetch wrapper with authentication
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @param {string} token - JWT token (from cookies or headers)
 * @returns {Promise<Response>}
 */
export async function serverFetch(endpoint, options = {}, token = null) {
    const url = `${API_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Add authorization token if provided
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
        // Server-side fetch should not cache by default for dynamic data
        cache: options.cache || 'no-store',
        next: options.next || { revalidate: 0 }, // No revalidation by default
    };

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('Server API Error:', error);
        throw error;
    }
}

/**
 * Get employees with server-side fetching
 * @param {Object} params - Query parameters
 * @param {string} token - JWT token
 * @returns {Promise<Object>}
 */
export async function getEmployeesServer(params = {}, token = null) {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.page) queryParams.append('page', params.page);
    if (params.search) queryParams.append('search', params.search);
    if (params.department) queryParams.append('department', params.department);
    if (params.designation) queryParams.append('designation', params.designation);
    if (params.status) queryParams.append('status', params.status);
    if (params.profileStatus) queryParams.append('profileStatus', params.profileStatus);

    const queryString = queryParams.toString();
    const endpoint = `/Employee${queryString ? `?${queryString}` : ''}`;

    const response = await serverFetch(endpoint, {
        method: 'GET',
        cache: 'no-store', // Always fetch fresh data
    }, token);

    return response.json();
}

/**
 * Get single employee by ID (server-side)
 * @param {string} employeeId - Employee ID
 * @param {string} token - JWT token
 * @returns {Promise<Object>}
 */
export async function getEmployeeByIdServer(employeeId, token = null) {
    const response = await serverFetch(`/Employee/${employeeId}`, {
        method: 'GET',
        cache: 'no-store',
    }, token);

    return response.json();
}

/**
 * Get token from cookies (for server components)
 * @param {Object} cookies - Next.js cookies object
 * @returns {string|null}
 */
export function getTokenFromCookies(cookies) {
    return cookies.get('token')?.value || null;
}




