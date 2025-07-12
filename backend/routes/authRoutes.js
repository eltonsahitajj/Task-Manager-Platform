const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Our User model
const auth = require('../middleware/auth'); // <--- NEW: Import the auth middleware
require('dotenv').config(); // Load environment variables for JWT secret

// Register a new user
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        // Attempt to create a user. The model handles hashing and checks for duplicates.
        const newUser = await User.create(username, password);

        // Generate JWT for immediate login after registration
        const token = jwt.sign(
            { user: { id: newUser.id, username: newUser.username } }, // <--- Ensure payload matches middleware expectation
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: newUser.id, username: newUser.username }
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        if (err.message.includes('duplicate key value violates unique constraint')) { // More specific check for duplicate username
            return res.status(409).json({ message: 'Username already taken' });
        }
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Find user by username
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // User authenticated, create JWT token
        const token = jwt.sign(
            { user: { id: user.id, username: user.username } }, // <--- Ensure payload matches middleware expectation
            process.env.JWT_SECRET, // Use a secret from environment variables
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.json({
            message: 'Logged in successfully',
            token,
            user: { id: user.id, username: user.username } // <--- Send user data back
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// NEW: Verify token route
router.get('/verify', auth, (req, res) => { // <--- ADD THIS ROUTE
    // If we reach here, the 'auth' middleware has successfully validated the token
    // and attached the user object (from the token's payload) to req.user.
    if (req.user && req.user.id) {
        res.json({
            message: 'Token verified',
            user: {
                id: req.user.id,
                username: req.user.username || 'unknown' // Use username from token if present, else 'unknown'
            }
        });
    } else {
        // This case should ideally not be reached if 'auth' middleware works correctly
        res.status(401).json({ message: 'Unauthorized: No valid user data after token verification.' });
    }
});

module.exports = router;