// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Ensure this path is correct for your database connection

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        // Check if user already exists
        const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user to database
        const newUser = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );

        // Generate JWT
        const payload = {
            user: { // This structure is important for req.user in middleware
                id: newUser.rows[0].id,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }, // Token expires in 1 hour
            (err, token) => {
                if (err) throw err;
                res.status(201).json({
                    message: 'User registered successfully',
                    token,
                    user: {
                        id: newUser.rows[0].id,
                        username: newUser.rows[0].username,
                    },
                });
            }
        );
    } catch (err) {
        console.error('Error in register:', err.message);
        res.status(500).send('Server error during registration');
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
const login = async (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }

    try {
        // Check if user exists
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid Credentials (User not found)' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials (Password mismatch)' });
        }

        // Generate JWT
        const payload = {
            user: { // This structure is important for req.user in middleware
                id: user.rows[0].id,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    message: 'Logged in successfully',
                    token,
                    user: {
                        id: user.rows[0].id,
                        username: user.rows[0].username,
                    },
                });
            }
        );
    } catch (err) {
        console.error('Error in login:', err.message);
        res.status(500).send('Server error during login');
    }
};

// @desc    Verify token and get user (used by frontend on app load)
// @route   GET /api/auth/verify
// This function is called after the 'auth' middleware successfully validates the token.
const verifyToken = (req, res) => {
    // If we reach here, the 'auth' middleware has already
    // verified the token and attached the user payload (req.user = decoded.user;)
    // to req.user.
    // We can simply send back the user info that was derived from the token.
    if (req.user && req.user.id) { // Check if req.user and its id exist
        // Note: For 'verify' it's often good to fetch the username from DB
        // to return full user object, but for simplicity, we'll use what's in token.
        // The username might not be directly in the token payload if you only stored ID.
        // If 'req.user' from decoded token only contains { id: ... },
        // you might need to fetch the username from the DB here if you want it
        // on initial verify. For now, we'll send what's available.
        res.json({
            message: 'Token verified',
            user: {
                id: req.user.id,
                // Add username if it was included in the token payload, or fetch it
                username: req.user.username || 'unknown' // Fallback if username isn't in token payload
            }
        });
    } else {
        // This case ideally shouldn't be reached if auth middleware is working correctly
        // and token has a valid user payload with an ID.
        res.status(401).json({ message: 'Unauthorized: No valid user data after token verification.' });
    }
};

// Export all functions so they can be imported by your routes file
module.exports = {
    register,
    login,
    verifyToken,
};