// backend/models/User.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');

const User = {
    // Find a user by their username
    findByUsername: async (username) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            return result.rows[0]; // Returns the user object or undefined
        } catch (err) {
            console.error('Error finding user by username:', err.message);
            throw new Error('Database error when finding user');
        }
    },

    // Create a new user
    create: async (username, password) => {
        try {
            // Hash the password before storing it
            const saltRounds = 10; // Standard number of salt rounds
            const password_hash = await bcrypt.hash(password, saltRounds);

            const result = await pool.query(
                'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
                [username, password_hash]
            );
            return result.rows[0]; // Returns the new user (without the hash)
        } catch (err) {
            console.error('Error creating user:', err.message);
            // Check for duplicate username error
            if (err.code === '23505' && err.constraint === 'users_username_key') {
                throw new Error('Username already exists');
            }
            throw new Error('Database error when creating user');
        }
    }
};

module.exports = User;