// backend/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth'); // Import the auth middleware

// All task routes now use the 'auth' middleware to protect them
// The 'auth' middleware will add req.user to the request if authenticated

// Get all tasks for the authenticated user
router.get('/', auth, async (req, res) => {
    try {
        const { search, status, sortBy, order } = req.query;
        const tasks = await Task.findAll(req.user.id, search, status, sortBy, order);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: 'Server error when fetching tasks' });
    }
});

// Get a single task by ID for the authenticated user
router.get('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id, req.user.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        res.json(task);
    } catch (err) {
        res.status(500).json({ message: 'Server error when fetching task' });
    }
});

// Create a new task for the authenticated user
router.post('/', auth, async (req, res) => {
    const { title, description, due_date } = req.body;
    try {
        const newTask = await Task.create(req.user.id, title, description, due_date);
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ message: 'Server error when creating task' });
    }
});

// Update a task for the authenticated user
router.put('/:id', auth, async (req, res) => {
    const updates = req.body;
    try {
        const updatedTask = await Task.update(req.params.id, req.user.id, updates);
        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ message: 'Server error when updating task' });
    }
});

// Delete a task for the authenticated user
router.delete('/:id', auth, async (req, res) => {
    try {
        const deletedTask = await Task.delete(req.params.id, req.user.id);
        if (!deletedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error when deleting task' });
    }
});

module.exports = router;