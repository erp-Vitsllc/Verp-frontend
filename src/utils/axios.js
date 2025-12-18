import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds timeout (increased for complex employee data)
});

// Request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        // For file uploads (FormData), don't set Content-Type header
        // Let the browser set it automatically with the correct boundary
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        
        // Add authorization token from localStorage if available
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        console.error('Axios Error:', error);
        if (error.response) {
            // Server responded with error status
            const errorData = error.response.data || {};
            
            // Handle 401 Unauthorized - token expired or invalid
            if (error.response.status === 401) {
                // Clear token and redirect to login
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('employeeUser');
                    localStorage.removeItem('userPermissions');
                    localStorage.removeItem('tokenExpiresIn');
                    
                    // Only redirect if not already on login page
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
            }
            
            return Promise.reject({
                message: errorData.message || `Server error: ${error.response.status}`,
                ...errorData
            });
        } else if (error.request) {
            // Request made but no response received
            console.error('No response received:', error.request);
            return Promise.reject({
                message: 'No response from server. Please check if the backend is running on http://localhost:5000'
            });
        } else {
            // Something else happened
            return Promise.reject({ message: error.message || 'An error occurred' });
        }
    }
);

export default axiosInstance;

