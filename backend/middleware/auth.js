// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const auth = (req, res, next) => {
    // Get token from header
    const token = req.header('Authorization'); // This is correct for the new setup

    // Check if not token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Expected format: "Bearer <token>", so split and get the token part
    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({ message: 'Token format is "Bearer <token>"' });
    }

    try {
        // Verify the token part after 'Bearer '
        const decoded = jwt.verify(tokenParts[1], process.env.JWT_SECRET);

        // Assuming your JWT payload is like { user: { id: '...' } }
        // We want req.user to directly contain the user object from the payload.
        req.user = decoded.user; // <--- MODIFIED: Assign decoded.user to req.user

        next(); // Proceed to the next middleware/route handler
    } catch (err) {
        console.error("Token verification error:", err.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = auth;