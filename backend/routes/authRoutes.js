// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Make sure bcrypt is installed (npm install bcrypt)
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Our User model
const auth = require('../middleware/auth'); // Your authentication middleware
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
        const newUser = await User.create(username, password); // User.create now handles hashing

        const token = jwt.sign(
            { user: { id: newUser.id, username: newUser.username } },
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
        if (err.message.includes('Username already exists')) {
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
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { user: { id: user.id, username: user.username } },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Logged in successfully',
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Verify token route (protected)
router.get('/verify', auth, (req, res) => {
    if (req.user && req.user.id) {
        res.json({
            message: 'Token verified',
            user: {
                id: req.user.id,
                username: req.user.username || 'unknown'
            }
        });
    } else {
        res.status(401).json({ message: 'Unauthorized: No valid user data after token verification.' });
    }
});

// Route to update user profile (username, password)
router.put('/profile', auth, async (req, res) => {
    const { username: newUsername, current_password, new_password } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const updates = {};

        // 1. Handle username update
        if (newUsername !== undefined && newUsername !== user.username) {
            if (!newUsername.trim()) {
                return res.status(400).json({ message: 'Username cannot be empty' });
            }
            // Check for username uniqueness is now handled by the User.update method
            updates.username = newUsername;
        }

        // 2. Handle password update
        if (new_password) {
            if (!current_password || !(await bcrypt.compare(current_password, user.password_hash))) {
                return res.status(401).json({ message: 'Incorrect current password' });
            }
            
            if (new_password.length < 6) {
                return res.status(400).json({ message: 'New password must be at least 6 characters long' });
            }

            updates.password_hash = await bcrypt.hash(new_password, 10); // Hash the new password
        }

        // Only attempt to update if there are changes
        if (Object.keys(updates).length > 0) {
            // NEW: Call the static User.update method
            const updatedUser = await User.update(user.id, updates);
            if (!updatedUser) {
                // This could happen if user not found, or another DB error
                return res.status(500).json({ message: 'Failed to update user in database.' });
            }
            res.json({
                message: 'Profile updated successfully',
                user: { id: updatedUser.id, username: updatedUser.username } // Return updated username
            });
        } else {
            res.json({
                message: 'No changes to apply to profile.',
                user: { id: user.id, username: user.username }
            });
        }

    } catch (err) {
        console.error('Profile update error:', err.message);
        // Catch specific error messages from User.update
        if (err.message.includes('Username already taken')) {
            return res.status(409).json({ message: 'Username already taken' });
        }
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

module.exports = router;