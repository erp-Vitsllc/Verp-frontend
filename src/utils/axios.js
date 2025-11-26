import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://verp-backend-2.onrender.com/api';

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 seconds timeout
});

// Request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        // You can add auth tokens here if needed
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

