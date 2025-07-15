// backend/models/User.js
const db = require('../config/db'); // Assuming this correctly imports your database connection
const bcrypt = require('bcrypt'); // Make sure bcrypt is imported for password hashing

class User {
    constructor({ id, username, password_hash }) {
        this.id = id;
        this.username = username;
        this.password_hash = password_hash;
    }

    // Static method to create a new user
    static async create(username, plainPassword) {
        const hashedPassword = await bcrypt.hash(plainPassword, 10); // Hash password with salt rounds 10
        try {
            const result = await db.query(
                'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, password_hash',
                [username, hashedPassword]
            );
            return new User(result.rows[0]);
        } catch (err) {
            if (err.code === '23505') { // PostgreSQL unique violation error code
                throw new Error('Username already exists');
            }
            throw err;
        }
    }

    // Static method to find a user by username
    static async findByUsername(username) {
        const result = await db.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            return new User(result.rows[0]);
        }
        return null;
    }

    // NEW/RE-VERIFIED Static method to find a user by ID
    static async findById(id) {
        const result = await db.query('SELECT id, username, password_hash FROM users WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            return new User(result.rows[0]);
        }
        return null;
    }

    // Static method to update user details
    static async update(id, updates) {
        const { username, password_hash } = updates;
        const setClauses = [];
        const queryParams = [];
        let paramIndex = 1;

        if (username !== undefined) {
            setClauses.push(`username = $${paramIndex++}`);
            queryParams.push(username);
        }
        if (password_hash !== undefined) {
            setClauses.push(`password_hash = $${paramIndex++}`);
            queryParams.push(password_hash);
        }

        if (setClauses.length === 0) {
            return null; // No updates provided, nothing to do
        }

        const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex++} RETURNING id, username, password_hash`;
        queryParams.push(id);

        try {
            const result = await db.query(query, queryParams);
            if (result.rows.length > 0) {
                return new User(result.rows[0]);
            }
            return null; // User not found or not updated
        } catch (err) {
            if (err.code === '23505') { // Unique violation
                throw new Error('Username already taken');
            }
            throw err;
        }
    }
}

module.exports = User;