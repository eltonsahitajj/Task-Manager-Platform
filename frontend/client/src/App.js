import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css'; // Make sure to import your CSS file

const API_URL = 'http://localhost:5000/api'; // Your backend API URL

function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token')); // Load token from localStorage
  const [isLoginMode, setIsLoginMode] = useState(true); // Toggle between login and register
  const [authMessage, setAuthMessage] = useState(''); // Auth success/error message
  const [authFormErrors, setAuthFormErrors] = useState({}); // Auth form validation errors

  // Task states
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium'); // Default priority for new tasks
  const [formError, setFormError] = useState(''); // Error for task creation form

  // Editing states
  const [editingTask, setEditingTask] = useState(null); // { id: ..., field: ... }
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [editedPriority, setEditedPriority] = useState('');

  // Filtering and Sorting states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterDueDateRange, setFilterDueDateRange] = useState('All Dates');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Delete confirmation modal state
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Subtask states
  const [isAddingSubtask, setIsAddingSubtask] = useState(false); // True when in subtask creation mode
  const [parentOfNewSubtask, setParentOfNewSubtask] = useState(null); // Stores the ID of the parent task

  // --- Utility Functions ---

  const getDueDateClass = (dueDate, status) => {
    if (status === 'Done') return ''; // No due date class if task is done

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize 'now' to start of day
    const due = dueDate ? new Date(dueDate) : null;

    if (!due) return ''; // No due date, no class

    due.setHours(0, 0, 0, 0); // Normalize 'due' to start of day

    if (due < now) {
      return 'task-overdue';
    } else if (due.getTime() === now.getTime()) {
      return 'task-due-today';
    } else if (due > now && due <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) { // Within next 7 days
      return 'task-due-soon';
    }
    return '';
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'High':
        return 'task-priority-high';
      case 'Medium':
        return 'task-priority-medium';
      case 'Low':
        return 'task-priority-low';
      default:
        return '';
    }
  };

  // --- Auth Handlers ---

  const handleAuth = async (e, isRegister) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    setAuthFormErrors({});

    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    // Client-side validation for auth form
    const currentErrors = {};
    if (!username || username.trim() === '') {
      currentErrors.username = 'Username is required.';
    }
    if (!password || password.trim() === '') {
      currentErrors.password = 'Password is required.';
    }
    setAuthFormErrors(currentErrors); // Set all errors at once

    if (Object.keys(currentErrors).length > 0) {
      setAuthLoading(false);
      return; // Stop if there are validation errors
    }

    try {
      const endpoint = isRegister ? 'register' : 'login';
      const res = await axios.post(`${API_URL}/auth/${endpoint}`, { username, password });

      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setIsAuthenticated(true);
      setUser(res.data.user);
      setAuthMessage(`Successfully ${isRegister ? 'registered and logged in' : 'logged in'}!`);
      // Clear form fields
      e.target.reset();

    } catch (err) {
      console.error('Auth error:', err.response?.data?.message || err.message);
      setAuthMessage(err.response?.data?.message || 'Authentication failed.');
      setIsAuthenticated(false);
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setAuthMessage('Logged out successfully.');
    setTasks([]); // Clear tasks on logout
    // Reset filters and sorts
    setSearchTerm('');
    setFilterStatus('All');
    setFilterPriority('All');
    setFilterDueDateRange('All Dates');
    setSortBy('created_at');
    setSortOrder('DESC');
    setIsAddingSubtask(false); // Reset subtask mode
    setParentOfNewSubtask(null);
  };

  // --- Task Operations ---

  // authAxios needs to be wrapped in useCallback to ensure it's re-created
  // only when the token changes, preventing infinite loops in useEffects.
  const authAxios = useCallback(axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }), [token]); // Re-create authAxios if token changes

  const fetchTasks = useCallback(async () => {
    if (!isAuthenticated) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (filterStatus && filterStatus !== 'All') {
        params.append('status', filterStatus);
      }
      if (filterPriority && filterPriority !== 'All') {
        params.append('priority', filterPriority);
      }
      if (filterDueDateRange && filterDueDateRange !== 'All Dates') {
        params.append('dueDateRange', filterDueDateRange);
      }

      params.append('sortBy', sortBy);
      params.append('order', sortOrder);

      const res = await authAxios.get(`/tasks?${params.toString()}`);
      setTasks(res.data);
    } catch (err) {
      console.error('Error fetching tasks:', err.response?.data?.message || err.message);
      // More specific error for task fetching might be needed if 500 persists
      setError('Failed to fetch tasks.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authAxios, searchTerm, filterStatus, sortBy, sortOrder, filterPriority, filterDueDateRange]); // Added filterPriority and filterDueDateRange

  // Initial authentication check on app load
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/auth/verify`, {
          // *** CRITICAL CHANGE: Ensure this header matches backend expectation ***
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsAuthenticated(true);
        setUser(res.data.user);
      } catch (err) {
        console.error('Token verification failed:', err.response?.data?.message || err.message);
        localStorage.removeItem('token');
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };
    verifyAuth();
  }, [token]); // Re-run when token changes (e.g., after login/logout)

  // Fetch tasks when auth status, filters, or sorts change
  useEffect(() => {
    fetchTasks();
  }, [isAuthenticated, authLoading, fetchTasks, searchTerm, filterStatus, sortBy, sortOrder, filterPriority, filterDueDateRange]); // Added fetchTasks to dependencies, as it's a memoized callback

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newTaskTitle.trim()) {
      setFormError('Task title cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      // Send parent_task_id if in subtask mode
      const taskData = {
        title: newTaskTitle,
        description: newTaskDescription,
        due_date: newTaskDueDate || null,
        priority: newTaskPriority,
        parent_task_id: isAddingSubtask ? parentOfNewSubtask : null
      };

      await authAxios.post('/tasks', taskData);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskDueDate('');
      setNewTaskPriority('Medium');
      setIsAddingSubtask(false); // Exit subtask mode
      setParentOfNewSubtask(null); // Clear parent task
      fetchTasks(); // Refresh tasks after creation
    } catch (err) {
      console.error('Error creating task:', err.response?.data?.message || err.message);
      setFormError(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskId, field, value) => {
    setLoading(true);
    setError('');
    try {
      await authAxios.put(`/tasks/${taskId}`, { [field]: value });
      setEditingTask(null); // Exit editing mode
      fetchTasks(); // Re-fetch tasks to get updated data
    } catch (err) {
      console.error(`Error updating task ${field}:`, err.response?.data?.message || err.message);
      setError(`Failed to update task ${field}.`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    setLoading(true);
    setError('');
    try {
      await authAxios.delete(`/tasks/${taskToDelete.id}`);
      fetchTasks(); // Refresh tasks after deletion
      setTaskToDelete(null); // Close modal
    } catch (err) {
      console.error('Error deleting task:', err.response?.data?.message || err.message);
      setError('Failed to delete task.');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  const handleEditClick = (task, field) => {
    setEditingTask({ id: task.id, field: field });
    switch (field) {
      case 'title':
        setEditedTitle(task.title);
        break;
      case 'description':
        setEditedDescription(task.description);
        break;
      case 'due_date':
        // Format date for input type="date" (YYYY-MM-DD)
        setEditedDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
        break;
      case 'status':
        setEditedStatus(task.status);
        break;
      case 'priority':
        setEditedPriority(task.priority);
        break;
      default:
        break;
    }
  };

  const handleInputBlur = (task, field) => {
    // Only update if value has changed
    let newValue;
    switch (field) {
      case 'title':
        newValue = editedTitle;
        if (newValue.trim() === '') {
          setError('Task title cannot be empty.');
          setEditingTask(null); // Exit editing mode if invalid
          return;
        }
        if (newValue === task.title) {
          setEditingTask(null);
          return;
        }
        break;
      case 'description':
        newValue = editedDescription;
        if (newValue === task.description) {
          setEditingTask(null);
          return;
        }
        break;
      case 'due_date':
        newValue = editedDueDate;
        // Compare formatted dates for change detection
        const existingDateFormatted = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '';
        if (newValue === existingDateFormatted) {
          setEditingTask(null);
          return;
        }
        break;
      case 'status':
        newValue = editedStatus;
        if (newValue === task.status) {
          setEditingTask(null);
          return;
        }
        break;
      case 'priority':
        newValue = editedPriority;
        if (newValue === task.priority) {
          setEditingTask(null);
          return;
        }
        break;
      default:
        setEditingTask(null); // Exit editing mode for unknown fields
        return;
    }
    handleUpdateTask(task.id, field, newValue);
  };

  const handleInputKeyPress = (e, task, field) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Trigger blur to save changes
    } else if (e.key === 'Escape') {
      setEditingTask(null); // Cancel editing
    }
  };

  // Render loading screen while authentication is in progress
  if (authLoading) {
    return <div className="loading-screen">Loading authentication...</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Task Manager</h1>
        <div className="auth-status">
          {isAuthenticated ? (
            <>
              <span>Logged in as: {user?.username}</span>
              <button onClick={handleLogout} className="logout-button">Logout</button>
            </>
          ) : (
            <div className="auth-nav">
              <button
                onClick={() => setIsLoginMode(true)}
                className={isLoginMode ? 'active' : ''}
              >
                Login
              </button>
              <button
                onClick={() => setIsLoginMode(false)}
                className={!isLoginMode ? 'active' : ''}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </header>

      {authMessage && (
        <p className={authMessage.includes('Success') ? 'success-message' : 'error-message'}>
          {authMessage}
        </p>
      )}

      {!isAuthenticated && (
        <section className="auth-forms-section">
          <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
          <form onSubmit={(e) => handleAuth(e, !isLoginMode)}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={isLoginMode ? undefined : undefined} // Controlled vs uncontrolled dilemma, reset by form.reset()
              onChange={(e) => { /* handle if needed for live validation */ }}
              required
            />
            {authFormErrors.username && <p className="form-error">{authFormErrors.username}</p>}
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={isLoginMode ? undefined : undefined} // Controlled vs uncontrolled dilemma
              onChange={(e) => { /* handle if needed for live validation */ }}
              required
            />
            {authFormErrors.password && <p className="form-error">{authFormErrors.password}</p>}
            <button type="submit" disabled={authLoading}>
              {authLoading ? '...' : (isLoginMode ? 'Login' : 'Register')}
            </button>
          </form>
          <p className="switch-auth-mode">
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthFormErrors({}); setAuthMessage(''); }}>
              {isLoginMode ? 'Register here' : 'Login here'}
            </button>
          </p>
        </section>
      )}

      {isAuthenticated && (
        <>
          <section className="task-creation-section">
            <h2>{isAddingSubtask ? `Add Subtask to "${tasks.find(t => t.id === parentOfNewSubtask)?.title}"` : 'Add New Task'}</h2>
            {formError && <p className="form-error">{formError}</p>}
            <form onSubmit={handleCreateTask} className="task-form">
              <input
                type="text"
                placeholder="Task Title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
              />
              <textarea
                placeholder="Task Description (Optional)"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
              ></textarea>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                title="Due Date"
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                title="Priority"
              >
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
              <button type="submit" disabled={loading}>
                {loading ? 'Adding...' : isAddingSubtask ? 'Create Subtask' : 'Add Task'}
              </button>
              {isAddingSubtask && (
                <button
                  type="button"
                  className="cancel-subtask-btn"
                  onClick={() => {
                    setIsAddingSubtask(false);
                    setParentOfNewSubtask(null);
                    setNewTaskTitle('');
                    setNewTaskDescription('');
                    setNewTaskDueDate('');
                    setNewTaskPriority('Medium');
                    setFormError('');
                    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see form
                  }}
                >
                  Cancel Subtask
                </button>
              )}
            </form>
          </section>

          <section className="task-list-section">
            <h2>Your Tasks</h2>
            {error && <p className="error-message">{error}</p>}

            <div className="controls-container">
              <div className="filters-container">
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="All">All Statuses</option>
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="filter-select"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
                <select
                  value={filterDueDateRange}
                  onChange={(e) => setFilterDueDateRange(e.target.value)}
                  className="filter-select"
                >
                  <option value="All Dates">All Due Dates</option>
                  <option value="Due Today">Due Today</option>
                  <option value="Due This Week">Due This Week</option>
                  <option value="Overdue">Overdue</option>
                  <option value="No Due Date">No Due Date</option>
                </select>
              </div>

              <div className="sort-container">
                <label htmlFor="sortBy">Sort by:</label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="created_at">Creation Date</option>
                  <option value="due_date">Due Date</option>
                  <option value="title">Title</option>
                  <option value="status">Status</option>
                  <option value="priority">Priority</option>
                </select>
                <label htmlFor="sortOrder">Order:</label>
                <select
                  id="sortOrder"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="sort-select"
                >
                  <option value="ASC">Ascending</option>
                  <option value="DESC">Descending</option>
                </select>
              </div>
            </div>

            {loading && <p>Loading tasks...</p>}
            {!loading && tasks.length === 0 && <p>No tasks found.</p>}

            <ul className="task-list">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className={`${task.status === 'Done' ? 'task-done' : ''} ${getDueDateClass(task.due_date, task.status)} ${getPriorityClass(task.priority)}`}
                >
                  {/* Editable Title */}
                  {editingTask && editingTask.id === task.id && editingTask.field === 'title' ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={() => handleInputBlur(task, 'title')}
                      onKeyDown={(e) => handleInputKeyPress(e, task, 'title')}
                      autoFocus
                      className="edit-input"
                    />
                  ) : (
                    <h3 onClick={() => handleEditClick(task, 'title')}>{task.title}</h3>
                  )}

                  {/* Editable Description */}
                  {editingTask && editingTask.id === task.id && editingTask.field === 'description' ? (
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      onBlur={() => handleInputBlur(task, 'description')}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingTask(null);
                      }}
                      autoFocus
                      className="edit-textarea"
                    />
                  ) : (
                    <p onClick={() => handleEditClick(task, 'description')}>
                      {task.description || 'No description'}
                    </p>
                  )}

                  {/* Editable Due Date */}
                  <p>
                    Due Date:{' '}
                    {editingTask && editingTask.id === task.id && editingTask.field === 'due_date' ? (
                      <input
                        type="date"
                        value={editedDueDate}
                        onChange={(e) => setEditedDueDate(e.target.value)}
                        onBlur={() => handleInputBlur(task, 'due_date')}
                        onKeyDown={(e) => handleInputKeyPress(e, task, 'due_date')}
                        autoFocus
                        className="edit-date-input"
                      />
                    ) : (
                      <span onClick={() => handleEditClick(task, 'due_date')}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Due Date'}
                      </span>
                    )}
                  </p>

                  {/* Editable Status */}
                  <p>
                    Status:{' '}
                    {editingTask && editingTask.id === task.id && editingTask.field === 'status' ? (
                      <select
                        value={editedStatus}
                        onChange={(e) => setEditedStatus(e.target.value)}
                        onBlur={() => handleInputBlur(task, 'status')}
                        autoFocus
                        className="edit-select"
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    ) : (
                      <span onClick={() => handleEditClick(task, 'status')}>{task.status}</span>
                    )}
                  </p>

                  {/* Editable Priority */}
                  <p>
                    Priority:{' '}
                    {editingTask && editingTask.id === task.id && editingTask.field === 'priority' ? (
                      <select
                        value={editedPriority}
                        onChange={(e) => setEditedPriority(e.target.value)}
                        onBlur={() => handleInputBlur(task, 'priority')}
                        autoFocus
                        className="edit-select"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    ) : (
                      <span onClick={() => handleEditClick(task, 'priority')}>{task.priority}</span>
                    )}
                  </p>

                  <small>
                    Created: {new Date(task.created_at).toLocaleString()}
                    {task.updated_at && ` | Last Updated: ${new Date(task.updated_at).toLocaleString()}`}
                  </small>

                  {/* Add Subtask Button */}
                  <button
                    className="add-subtask-btn"
                    onClick={() => {
                      setIsAddingSubtask(true);
                      setParentOfNewSubtask(task.id);
                      setNewTaskTitle(''); // Clear previous new task title
                      setNewTaskDescription(''); // Clear previous new task description
                      setNewTaskDueDate(''); // Clear previous new task due date
                      setNewTaskPriority('Medium'); // Reset priority for subtask
                      setFormError(''); // Clear any previous form errors
                      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see form
                    }}
                    title="Add Subtask"
                  >
                    + Subtask
                  </button>

                  <button
                    className="delete-btn"
                    onClick={() => setTaskToDelete(task)}
                    title="Delete Task"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete the task:</p>
            <p className="modal-task-title">"{taskToDelete.title}"?</p>
            <p>This action cannot be undone.</p>
            <div className="modal-buttons">
              <button onClick={confirmDeleteTask} className="btn-confirm-delete">Yes, Delete</button>
              <button onClick={cancelDeleteTask} className="btn-cancel-delete">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;