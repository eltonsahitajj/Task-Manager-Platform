// backend/controllers/taskController.js
// backend/controllers/taskController.js
const pool = require('../config/db');
const Task = require('../models/Task');

// Get all tasks (with search, filter, and sorting options)
const getAllTasks = async (req, res) => {
    const userId = req.user.id;
    const { search, status, sortBy, order, priority, dueDateRange } = req.query;

    try {
        const tasks = await Task.findAll(userId, search, status, sortBy, order, priority, dueDateRange);
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err.message);
        res.status(500).send('Server error');
    }
};

// Create a new task (modified to accept parent_task_id)
const createTask = async (req, res) => {
    const { title, description, due_date, priority, parent_task_id } = req.body; // <--- MODIFIED
    const userId = req.user.id;

    if (!title || title.trim() === '') {
        return res.status(400).json({ message: 'Task title cannot be empty.' });
    }

    try {
        const newTask = await Task.create(userId, title, description, due_date, priority, parent_task_id); // <--- MODIFIED
        res.status(201).json(newTask);
    } catch (err) {
        console.error('Error creating task:', err.message);
        res.status(500).send('Server error during task creation');
    }
};

// Update an existing task (no changes)
const updateTask = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    if (updates.title !== undefined && updates.title.trim() === '') {
        return res.status(400).json({ message: 'Task title cannot be empty.' });
    }

    try {
        const updatedTask = await Task.update(id, userId, updates);
        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized.' });
        }
        res.json(updatedTask);
    } catch (err) {
        console.error('Error updating task:', err.message);
        res.status(500).send('Server error during task update');
    }
};

// Delete a task (no changes)
const deleteTask = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const deletedTask = await Task.delete(id, userId);
        if (!deletedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized.' });
        }
        res.json({ message: 'Task deleted successfully.', deletedTask: deletedTask });
    } catch (err) {
        console.error('Error deleting task:', err.message);
        res.status(500).send('Server error during task deletion');
    }
};

module.exports = {
    getAllTasks,
    createTask,
    updateTask,
    deleteTask
};