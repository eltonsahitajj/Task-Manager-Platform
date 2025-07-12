// frontend/client/src/components/RegisterForm.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook
import './AuthForms.css'; // We'll create this CSS file next

function RegisterForm({ onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); // For success or error messages
  const [loading, setLoading] = useState(false); // For loading state

  const { register } = useAuth(); // Get the register function from context

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages
    setLoading(true);

    const result = await register(username, password);

    if (result.success) {
      setMessage(result.message || 'Registration successful! You can now log in.');
      setUsername('');
      setPassword('');
      // Optionally, switch to login form automatically
      setTimeout(() => onSwitchToLogin(), 2000);
    } else {
      setMessage(result.message || 'Registration failed.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-form-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="register-username">Username:</label>
          <input
            type="text"
            id="register-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            aria-describedby="username-info"
          />
          <small id="username-info">Choose a unique username.</small>
        </div>
        <div className="form-group">
          <label htmlFor="register-password">Password:</label>
          <input
            type="password"
            id="register-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            aria-describedby="password-info"
          />
          <small id="password-info">Password must be at least 6 characters long.</small>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      {message && (
        <p className={`auth-message ${message.includes('successful') ? 'success' : 'error'}`}>
          {message}
        </p>
      )}
      <p className="switch-auth-mode">
        Already have an account? <span onClick={onSwitchToLogin}>Login here.</span>
      </p>
    </div>
  );
}

export default RegisterForm;