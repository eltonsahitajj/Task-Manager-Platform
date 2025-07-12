// backend/models/Task.js
const pool = require('../config/db');

const Task = {
    // Create a new task (modified to accept parentTaskId)
    create: async (userId, title, description, dueDate, priority = 'Medium', parentTaskId = null) => { // <--- MODIFIED
        try {
            const result = await pool.query(
                'INSERT INTO tasks (user_id, title, description, due_date, status, priority, parent_task_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', // <--- MODIFIED
                [userId, title, description, dueDate, 'To Do', priority, parentTaskId] // <--- MODIFIED
            );
            return result.rows[0];
        } catch (err) {
            console.error('Error in Task.create:', err.message);
            throw new Error('Database error during task creation');
        }
    },

    // Find all tasks for a specific user with search, filter, and sorting options
    // (No changes in this version for parentTaskId, will be addressed next for fetching)
    findAll: async (userId, search, status, sortBy = 'created_at', sortOrder = 'DESC', filterPriority, dueDateRange) => {
        let query = `SELECT * FROM tasks WHERE user_id = $1`;
        const params = [userId];
        let paramCount = 2;

        if (search) {
            query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (status && status !== 'All') {
            query += ` AND status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (filterPriority && filterPriority !== 'All') {
            query += ` AND priority = $${paramCount}`;
            params.push(filterPriority);
            paramCount++;
        }

        if (dueDateRange && dueDateRange !== 'All Dates') {
            switch (dueDateRange) {
                case 'Due Today':
                    query += ` AND due_date = CURRENT_DATE AND status != 'Done'`;
                    break;
                case 'Due This Week':
                    query += ` AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '7 days' AND status != 'Done'`;
                    break;
                case 'Overdue':
                    query += ` AND due_date < CURRENT_DATE AND status != 'Done'`;
                    break;
                case 'No Due Date':
                    query += ` AND due_date IS NULL`;
                    break;
                default:
                    break;
            }
        }

        const validSortColumns = ['created_at', 'due_date', 'title', 'status', 'priority'];
        const validSortOrder = ['ASC', 'DESC'];

        const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const safeSortOrder = validSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        let orderByClause = `"${safeSortBy}" ${safeSortOrder}`;
        if (safeSortBy === 'due_date') {
            orderByClause = `"${safeSortBy}" ${safeSortOrder} ${safeSortOrder === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST'}`;
        }

        query += ` ORDER BY ${orderByClause}`;

        try {
            const result = await pool.query(query, params);
            return result.rows;
        } catch (err) {
            console.error('Error in Task.findAll:', err.message);
            throw new Error('Database error when fetching tasks');
        }
    },

    // Update an existing task (no changes)
    update: async (taskId, userId, updates) => {
        const validUpdateColumns = ['title', 'description', 'status', 'due_date', 'priority'];
        const updateClauses = [];
        const params = [taskId, userId];
        let paramIndex = 3;

        for (const key in updates) {
            if (validUpdateColumns.includes(key)) {
                if (key === 'due_date') {
                    updateClauses.push(`${key} = CAST($${paramIndex} AS DATE)`);
                } else {
                    updateClauses.push(`${key} = $${paramIndex}`);
                }
                params.push(updates[key]);
                paramIndex++;
            }
        }

        if (updateClauses.length === 0) {
            return null;
        }

        const query = `UPDATE tasks SET ${updateClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`;

        try {
            const result = await pool.query(query, params);
            return result.rows[0];
        } catch (err) {
            console.error('Error in Task.update:', err.message);
            throw new Error('Database error during task update');
        }
    },

    // Delete a task (no changes)
    delete: async (taskId, userId) => {
        try {
            const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *', [taskId, userId]);
            return result.rows[0];
        } catch (err) {
            console.error('Error in Task.delete:', err.message);
            throw new Error('Database error during task deletion');
        }
    }
};

module.exports = Task;