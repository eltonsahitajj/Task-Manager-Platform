// frontend/client/src/components/LoginForm.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook
import './AuthForms.css'; // We'll create this CSS file next

function LoginForm({ onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); // For success or error messages
  const [loading, setLoading] = useState(false); // For loading state

  const { login } = useAuth(); // Get the login function from context

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      setMessage('Login successful!');
      setUsername('');
      setPassword('');
      // No need to switch forms, App.js will handle redirect
    } else {
      setMessage(result.message || 'Login failed. Please check your credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-form-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="login-username">Username:</label>
          <input
            type="text"
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password:</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {message && (
        <p className={`auth-message ${message.includes('successful') ? 'success' : 'error'}`}>
          {message}
        </p>
      )}
      <p className="switch-auth-mode">
        Don't have an account? <span onClick={onSwitchToRegister}>Register here.</span>
      </p>
    </div>
  );
}

export default LoginForm;