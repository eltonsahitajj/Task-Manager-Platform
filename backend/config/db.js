// backend/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('Attempting to load database config from .env...');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
// console.log('DB_PASSWORD:', process.env.DB_PASSWORD); // Don't log actual password in production, but useful for debugging
console.log('DB_PORT:', process.env.DB_PORT);


const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

console.log('Attempting to connect to database...');
pool.connect()
    .then(() => {
        console.log('Connected to the database');
    })
    .catch((err) => {
        console.error('Database connection error:', err.stack);
    });

module.exports = pool;