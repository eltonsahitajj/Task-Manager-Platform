import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// Create the AuthContext
const AuthContext = createContext();

// Define your API base URL
const API_URL = 'http://localhost:5000/api/auth';

// Helper function to decode Base64Url string to plain string (handles padding)
const base64UrlDecode = (str) => {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
        case 0:
            break;
        case 2:
            output += '==';
            break;
        case 3:
            output += '=';
            break;
        default:
            throw new Error('Illegal base64url string!');
    }
    try {
        return decodeURIComponent(atob(output).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (e) {
        throw new Error('Failed to decode base64url string: ' + e.message);
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [authLoading, setLoading] = useState(true);

    // Effect hook to update Axios default headers whenever the token changes
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            console.log("AuthContext: Axios Authorization header SET:", axios.defaults.headers.common['Authorization']);
        } else {
            delete axios.defaults.headers.common['Authorization'];
            console.log("AuthContext: Axios Authorization header REMOVED.");
        }
    }, [token]);

    const loadUser = async () => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            console.log("AuthContext: Token found in localStorage, attempting to decode:", storedToken);
            try {
                const decoded = base64UrlDecode(storedToken.split('.')[1]);
                const decodedToken = JSON.parse(decoded);

                const currentTime = Date.now() / 1000;
                if (decodedToken.exp < currentTime) {
                    console.log("AuthContext: Token expired, logging out from loadUser (expiration).");
                    logout();
                } else {
                    setUser({ id: decodedToken.id, username: decodedToken.username });
                    setToken(storedToken);
                }
            } catch (error) {
                console.error("AuthContext: Failed to decode token or token invalid (in loadUser):", error);
                logout();
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        loadUser();
    }, []);

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/login`, { username, password });
            const receivedToken = response.data.token;
            localStorage.setItem('token', receivedToken);
            setToken(receivedToken);

            try {
                const decoded = base64UrlDecode(receivedToken.split('.')[1]);
                const decodedToken = JSON.parse(decoded);
                setUser({ id: decodedToken.id, username: decodedToken.username });
            } catch (decodeError) {
                console.error("AuthContext: Error decoding token immediately after login:", decodeError);
                logout();
                return { success: false, message: 'Failed to process login token. Please try again.' };
            }
            return { success: true };
        } catch (error) {
            console.error('Login error (API response):', error.response?.data?.message || error.message);
            return { success: false, message: error.response?.data?.message || 'Login failed' };
        }
    };

    const register = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/register`, { username, password });
            return { success: true, message: response.data.message };
        } catch (error) {
            console.error('Registration error:', error.response?.data?.message || error.message);
            return { success: false, message: error.response?.data?.message || 'Registration failed' };
        }
    };

    const logout = () => {
        // debugger; // You can keep or remove this debugger, it's not strictly needed for this issue now
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
        console.log("AuthContext: Performed actual logout actions.");
    };

    return (
        <AuthContext.Provider value={{ user, token, authLoading, login, register, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};