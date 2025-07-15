// frontend/client/src/App.js
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
  const [authFormErrors, setAuthFormErrors] = useState({}); // Auth form validation errors

  // Notification state
  const [notification, setNotification] = useState({ message: '', type: '', id: null }); // id for unique key to trigger re-render

  // Task states
  const [tasks, setTasks] = useState([]); // This will store the *unfiltered* tasks fetched from backend
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // General error for task list

  // Task creation form states
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

  // NEW: Profile Management States
  const [showProfileSettings, setShowProfileSettings] = useState(false); // Controls visibility of profile section
  const [profileUsername, setProfileUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [profileErrors, setProfileErrors] = useState({}); // Errors for profile update form
  const [profileLoading, setProfileLoading] = useState(false); // Loading state for profile update


  // --- Utility Functions for Task Display ---

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

  // Function to display a toast notification
  const showNotification = useCallback((message, type) => {
    // Clear any existing timeout to prevent multiple toasts overlapping
    if (notification.id) {
      clearTimeout(notification.id);
    }
    const newId = setTimeout(() => {
      setNotification({ message: '', type: '', id: null });
    }, 4000); // Notification disappears after 4 seconds
    setNotification({ message, type, id: newId });
  }, [notification.id]); // Dependency on notification.id to clear previous timeouts


  // Function to build a hierarchical task tree
  const buildTaskTree = useCallback((flatTasks) => {
    const taskMap = new Map(flatTasks.map(task => [task.id, { ...task, children: [] }]));
    const rootTasks = [];

    taskMap.forEach(task => {
      if (task.parent_task_id) {
        const parent = taskMap.get(task.parent_task_id);
        if (parent) {
          parent.children.push(task);
        } else {
          // If a parent is not found (e.g., deleted), treat as a root task
          rootTasks.push(task);
        }
      } else {
        rootTasks.push(task);
      }
    });

    // Sort root tasks and their children based on current sortBy and sortOrder
    const sortTasks = (tasksToSort) => {
      return [...tasksToSort].sort((a, b) => {
        let valA, valB;
        if (sortBy === 'created_at' || sortBy === 'due_date') {
          valA = a[sortBy] ? new Date(a[sortBy]) : (sortBy === 'due_date' ? new Date('9999-12-31') : new Date(0)); // Handle null due_date, put at end for due_date ASC
          valB = b[sortBy] ? new Date(b[sortBy]) : (sortBy === 'due_date' ? new Date('9999-12-31') : new Date(0));
        } else if (sortBy === 'priority') {
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            valA = priorityOrder[a.priority];
            valB = priorityOrder[b.priority];
        } else { // For string comparisons like title or status
            valA = (a[sortBy] || '').toLowerCase();
            valB = (b[sortBy] || '').toLowerCase();
        }

        if (sortOrder === 'ASC') {
            if (valA < valB) return -1;
            if (valA > valB) return 1;
        } else { // DESC
            if (valA < valB) return 1;
            if (valA > valB) return -1;
        }
        return 0;
      });
    };

    const sortedRootTasks = sortTasks(rootTasks);

    // Recursively sort children as well
    const recursivelySortChildren = (tasks) => {
      tasks.forEach(task => {
        if (task.children && task.children.length > 0) {
          task.children = sortTasks(task.children);
          recursivelySortChildren(task.children); // Recurse for deeper levels
        }
      });
    };
    recursivelySortChildren(sortedRootTasks);

    return sortedRootTasks;
  }, [sortBy, sortOrder]);


  // --- Auth Handlers ---

  const handleAuth = async (e, isRegister) => {
    e.preventDefault();
    setAuthLoading(true);
    setNotification({ message: '', type: '', id: null }); // Clear previous notification
    setAuthFormErrors({});

    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    const currentErrors = {};
    if (!username || username.trim() === '') {
      currentErrors.username = 'Username is required.';
    }
    if (!password || password.trim() === '') {
      currentErrors.password = 'Password is required.';
    }
    setAuthFormErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      setAuthLoading(false);
      return;
    }

    try {
      const endpoint = isRegister ? 'register' : 'login';
      const res = await axios.post(`${API_URL}/auth/${endpoint}`, { username, password });

      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setIsAuthenticated(true);
      setUser(res.data.user);
      setProfileUsername(res.data.user.username); // Initialize profile username
      showNotification(`Successfully ${isRegister ? 'registered and logged in' : 'logged in'}!`, 'success');
      e.target.reset();

    } catch (err) {
      console.error('Auth error:', err.response?.data?.message || err.message);
      showNotification(err.response?.data?.message || 'Authentication failed.', 'error');
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
    showNotification('Logged out successfully.', 'success');
    setTasks([]); // Clear tasks on logout
    // Reset all task-related and filter/sort states
    setSearchTerm('');
    setFilterStatus('All');
    setFilterPriority('All');
    setFilterDueDateRange('All Dates');
    setSortBy('created_at');
    setSortOrder('DESC');
    setIsAddingSubtask(false);
    setParentOfNewSubtask(null);
    // NEW: Reset profile states
    setShowProfileSettings(false);
    setProfileUsername('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setProfileErrors({});
  };

  // --- Task Operations & User Profile Operations ---

  // Centralized Axios instance for authenticated requests
  const authAxios = useCallback(axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }), [token]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!isAuthenticated) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(''); // Clear general task list error

    try {
      // Fetch all tasks for the user, client-side will handle advanced filtering
      const res = await authAxios.get(`/tasks`); // No query params here
      setTasks(res.data); // Store raw (unfiltered) data
    } catch (err) {
      console.error('Error fetching tasks:', err.response?.data?.message || err.message);
      setError('Failed to fetch tasks.'); // Set general task list error
      showNotification('Failed to fetch tasks.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authAxios, showNotification]);

  // Authenticate on mount or token change
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/auth/verify`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsAuthenticated(true);
        setUser(res.data.user);
        setProfileUsername(res.data.user.username); // Initialize profile username
      } catch (err) {
        console.error('Token verification failed:', err.response?.data?.message || err.message);
        localStorage.removeItem('token');
        setToken(null);
        setIsAuthenticated(false);
        showNotification('Session expired or invalid. Please log in again.', 'error');
      } finally {
        setAuthLoading(false);
      }
    };
    verifyAuth();
  }, [token, showNotification]);

  // Fetch tasks when auth status changes
  useEffect(() => {
    fetchTasks();
  }, [isAuthenticated, authLoading, fetchTasks]);

  // --- NEW: handleUpdateProfile ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileErrors({}); // Clear previous errors

    const currentErrors = {};
    if (!profileUsername.trim()) {
      currentErrors.username = 'Username cannot be empty.';
    }
    if (newPassword && newPassword.length < 6) {
      currentErrors.newPassword = 'New password must be at least 6 characters long.';
    }
    if (newPassword && newPassword !== confirmNewPassword) {
      currentErrors.confirmNewPassword = 'New passwords do not match.';
    }
    // If updating password, current password is required
    if (newPassword && !currentPassword) {
        currentErrors.currentPassword = 'Current password is required to change password.';
    }

    setProfileErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      setProfileLoading(false);
      return;
    }

    try {
      const updateData = {
        username: profileUsername,
      };
      if (newPassword) {
        updateData.current_password = currentPassword;
        updateData.new_password = newPassword;
      }

      const res = await authAxios.put('/auth/profile', updateData);
      
      setUser(res.data.user); // Update user state with new username
      setProfileUsername(res.data.user.username); // Ensure profile form shows new username

      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      showNotification('Profile updated successfully!', 'success');

      // If password was changed, force re-login for security
      if (newPassword) {
        showNotification('Password updated. Please log in with your new password.', 'info');
        handleLogout(); // This will clear token and redirect to login
      }

    } catch (err) {
      console.error('Profile update error:', err.response?.data?.message || err.message);
      setProfileErrors({ api: err.response?.data?.message || 'Failed to update profile.' });
      showNotification(err.response?.data?.message || 'Failed to update profile.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };


  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormError(''); // Clear form-specific error

    if (!newTaskTitle.trim()) {
      setFormError('Task title cannot be empty.');
      return;
    }

    setLoading(true);
    try {
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
      setIsAddingSubtask(false);
      setParentOfNewSubtask(null);
      fetchTasks();
      showNotification('Task created successfully!', 'success');
    } catch (err) {
      console.error('Error creating task:', err.response?.data?.message || err.message);
      setFormError(err.response?.data?.message || 'Failed to create task.'); // Set form-specific error
      showNotification('Failed to create task.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskId, field, value) => {
    setLoading(true);
    setError(''); // Clear general task list error
    try {
      await authAxios.put(`/tasks/${taskId}`, { [field]: value });
      setEditingTask(null);
      fetchTasks();
      showNotification('Task updated successfully!', 'success');
    } catch (err) {
      console.error(`Error updating task ${field}:`, err.response?.data?.message || err.message);
      setError(`Failed to update task ${field}.`); // Set general task list error
      showNotification(`Failed to update task ${field}.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Function to toggle task status
  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
    setLoading(true);
    setError('');
    try {
      await authAxios.put(`/tasks/${task.id}`, { status: newStatus });
      fetchTasks(); // Re-fetch to ensure consistency and re-apply filters/sorts
      showNotification(`Task "${task.title}" marked as ${newStatus}!`, 'success');
    } catch (err) {
      console.error('Error toggling task status:', err.response?.data?.message || err.message);
      setError('Failed to update task status.');
      showNotification('Failed to update task status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Function to mark all subtasks as done
  const handleMarkAllSubtasksDone = async (parentTask) => {
    setLoading(true);
    setError('');
    try {
      // To properly get ALL descendants, we need a map of all tasks
      const allTasksMap = new Map(tasks.map(t => [t.id, { ...t, children: [] }]));
      allTasksMap.forEach(t => {
          if (t.parent_task_id && allTasksMap.has(t.parent_task_id)) {
              allTasksMap.get(t.parent_task_id).children.push(allTasksMap.get(t.id));
          }
      });

      const getDeepSubtaskIds = (taskNode) => {
          let ids = [];
          if (taskNode.children && taskNode.children.length > 0) {
              taskNode.children.forEach(child => {
                  ids.push(child.id);
                  ids = ids.concat(getDeepSubtaskIds(child));
              });
          }
          return ids;
      };

      const parentTaskNode = allTasksMap.get(parentTask.id);
      const subtaskIdsToUpdate = parentTaskNode ? getDeepSubtaskIds(parentTaskNode) : [];


      if (subtaskIdsToUpdate.length === 0) {
        showNotification(`No subtasks found for "${parentTask.title}".`, 'info');
        setLoading(false);
        return;
      }

      // Send individual update requests for each subtask
      const updatePromises = subtaskIdsToUpdate.map(id =>
        authAxios.put(`/tasks/${id}`, { status: 'Done' })
      );

      await Promise.all(updatePromises); // Wait for all updates to complete
      fetchTasks(); // Re-fetch all tasks to reflect changes
      showNotification(`All ${subtaskIdsToUpdate.length} subtasks of "${parentTask.title}" marked as Done!`, 'success');
    } catch (err) {
      console.error('Error marking subtasks done:', err.response?.data?.message || err.message);
      setError('Failed to mark subtasks done.');
      showNotification('Failed to mark subtasks done.', 'error');
    } finally {
      setLoading(false);
    }
  };


  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    setLoading(true);
    setError(''); // Clear general task list error
    try {
      await authAxios.delete(`/tasks/${taskToDelete.id}`);
      fetchTasks();
      setTaskToDelete(null); // Close modal
      showNotification('Task deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting task:', err.response?.data?.message || err.message);
      setError('Failed to delete task.'); // Set general task list error
      showNotification('Failed to delete task.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  const handleEditClick = (task, field) => {
    setEditingTask({ id: task.id, field: field });
    setError(''); // Clear any general task list error when starting edit
    switch (field) {
      case 'title':
        setEditedTitle(task.title);
        break;
      case 'description':
        setEditedDescription(task.description);
        break;
      case 'due_date':
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
    let newValue;
    switch (field) {
      case 'title':
        newValue = editedTitle;
        if (newValue.trim() === '') {
          setError('Task title cannot be empty.'); // Set error for task list
          showNotification('Task title cannot be empty.', 'error');
          setEditingTask(null);
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
        setEditingTask(null);
        return;
    }
    handleUpdateTask(task.id, field, newValue);
  };

  const handleInputKeyPress = (e, task, field) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setEditingTask(null);
    }
  };

  // Function to apply hierarchical filtering
  const getFilteredTasksToDisplay = useCallback(() => {
    if (!tasks.length) return [];

    const taskMap = new Map(tasks.map(task => [task.id, task]));
    const tasksToInclude = new Set(); // Use a Set for efficient ID lookup

    // Pass 1: Identify tasks that directly match filters and include their ancestors
    tasks.forEach(task => {
      let matchesSearch = searchTerm === '' || task.title.toLowerCase().includes(searchTerm.toLowerCase()) || task.description.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = filterStatus === 'All' || task.status === filterStatus;
      let matchesPriority = filterPriority === 'All' || task.priority === filterPriority;
      let matchesDueDate = true; // Assume true until proven false by a filter

      if (filterDueDateRange !== 'All Dates') {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const taskDueDate = task.due_date ? new Date(task.due_date) : null;
        if (taskDueDate) taskDueDate.setHours(0, 0, 0, 0);

        switch (filterDueDateRange) {
          case 'Due Today':
            matchesDueDate = taskDueDate && taskDueDate.getTime() === now.getTime();
            break;
          case 'Due This Week':
            const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            matchesDueDate = taskDueDate && taskDueDate >= now && taskDueDate <= oneWeekLater;
            break;
          case 'Overdue':
            matchesDueDate = taskDueDate && taskDueDate < now && task.status !== 'Done';
            break;
          case 'No Due Date':
            matchesDueDate = !task.due_date;
            break;
          default:
            matchesDueDate = true;
            break;
        }
      }

      if (matchesSearch && matchesStatus && matchesPriority && matchesDueDate) {
        // If a task matches, add it and all its ancestors
        let currentTask = task;
        while (currentTask && !tasksToInclude.has(currentTask.id)) {
          tasksToInclude.add(currentTask.id);
          currentTask = taskMap.get(currentTask.parent_task_id);
        }
      }
    });

    // Pass 2: Include all descendants of tasks that are already included
    const finalTasksToDisplay = new Set();

    // Helper to get all descendants of a task
    const addDescendants = (taskId) => {
        const queue = [taskId];
        let head = 0;
        while (head < queue.length) {
            const currentId = queue[head++];
            finalTasksToDisplay.add(currentId);
            tasks.forEach(t => {
                if (t.parent_task_id === currentId && !finalTasksToDisplay.has(t.id)) {
                    queue.push(t.id);
                }
            });
        }
    };

    // Add all tasks initially identified (from Pass 1) and their descendants
    tasksToInclude.forEach(id => {
        addDescendants(id);
    });

    // Filter the original tasks array based on the IDs collected
    return tasks.filter(task => finalTasksToDisplay.has(task.id));
  }, [tasks, searchTerm, filterStatus, filterPriority, filterDueDateRange]);


  // Recursive function to render tasks and their children
  const renderTask = (task, depth = 0) => (
    <li
      key={task.id}
      className={`task-item ${task.status === 'Done' ? 'task-done' : ''} ${getDueDateClass(task.due_date, task.status)} ${getPriorityClass(task.priority)}`}
      style={{ '--indent-level': depth }} // Custom property for CSS indenting
    >
      <div className="task-content">
        {/* Checkbox for task completion */}
        <input
          type="checkbox"
          checked={task.status === 'Done'}
          onChange={() => handleToggleStatus(task)}
          className="task-completion-checkbox"
          title={`Mark as ${task.status === 'Done' ? 'To Do' : 'Done'}`}
        />

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
          <h3 className="task-title" onClick={() => handleEditClick(task, 'title')}>{task.title}</h3>
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
          <p className="task-description" onClick={() => handleEditClick(task, 'description')}>
            {task.description || 'No description'}
          </p>
        )}

        <p className="task-detail">
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

        <p className="task-detail">
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

        <p className="task-detail">
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

        <small className="task-timestamps">
          Created: {new Date(task.created_at).toLocaleString()}
          {task.updated_at && ` | Last Updated: ${new Date(task.updated_at).toLocaleString()}`}
        </small>
      </div>

      <div className="task-actions">
        {/* Only allow adding subtasks if task is not "Done" */}
        {task.status !== 'Done' && (
          <button
            className="add-subtask-btn"
            onClick={() => {
              setIsAddingSubtask(true);
              setParentOfNewSubtask(task.id);
              setNewTaskTitle('');
              setNewTaskDescription('');
              setNewTaskDueDate('');
              setNewTaskPriority('Medium');
              setFormError('');
              setShowProfileSettings(false); // Hide profile settings when adding subtask
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Add Subtask"
          >
            + Subtask
          </button>
        )}

        {/* Mark All Subtasks Done Button */}
        {task.children.length > 0 && task.status !== 'Done' && (
          <button
            className="mark-subtasks-done-btn"
            onClick={() => handleMarkAllSubtasksDone(task)}
            title="Mark all subtasks as Done"
          >
            Mark Subtasks Done
          </button>
        )}

        <button
          className="delete-btn"
          onClick={() => setTaskToDelete(task)}
          title="Delete Task"
        >
          Delete
        </button>
      </div>

      {task.children.length > 0 && (
        <ul className="subtask-list">
          {task.children.map(child => renderTask(child, depth + 1))}
        </ul>
      )}
    </li>
  );


  // --- Render Logic ---

  if (authLoading) {
    return <div className="loading-screen">Loading authentication...</div>;
  }

  // Get the hierarchically filtered tasks for display
  const filteredTasksToDisplay = getFilteredTasksToDisplay();
  // Then, build the tree from these filtered tasks
  const taskTree = buildTaskTree(filteredTasksToDisplay);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Task Manager</h1>
        <div className="auth-status">
          {isAuthenticated ? (
            <>
              <span>Logged in as: {user?.username}</span>
              <button
                onClick={() => setShowProfileSettings(!showProfileSettings)}
                className="profile-settings-button" // New button for profile settings
                title="Manage Profile Settings"
              >
                {showProfileSettings ? 'Hide Profile' : 'Profile Settings'}
              </button>
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

      {/* Toast Notification Display */}
      {notification.message && (
        <div key={notification.id} className={`toast-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {!isAuthenticated && (
        <section className="auth-forms-section">
          <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
          <form onSubmit={(e) => handleAuth(e, !isLoginMode)}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              required
            />
            {authFormErrors.username && <p className="form-error">{authFormErrors.username}</p>}
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
            />
            {authFormErrors.password && <p className="form-error">{authFormErrors.password}</p>}
            <button type="submit" disabled={authLoading}>
              {authLoading ? '...' : (isLoginMode ? 'Login' : 'Register')}
            </button>
          </form>
          <p className="switch-auth-mode">
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthFormErrors({}); setNotification({ message: '', type: '', id: null }); }}>
              {isLoginMode ? 'Register here' : 'Login here'}
            </button>
          </p>
        </section>
      )}

      {isAuthenticated && (
        <>
          {/* NEW: Profile Settings Section */}
          {showProfileSettings && (
            <section className="profile-settings-section">
              <h2>Profile Settings</h2>
              {profileErrors.api && <p className="form-error">{profileErrors.api}</p>}
              <form onSubmit={handleUpdateProfile}>
                <label>
                  Username:
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    required
                  />
                  {profileErrors.username && <p className="form-error">{profileErrors.username}</p>}
                </label>
                <label>
                  Current Password (required for password change):
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  {profileErrors.currentPassword && <p className="form-error">{profileErrors.currentPassword}</p>}
                </label>
                <label>
                  New Password:
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                  />
                  {profileErrors.newPassword && <p className="form-error">{profileErrors.newPassword}</p>}
                </label>
                <label>
                  Confirm New Password:
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  {profileErrors.confirmNewPassword && <p className="form-error">{profileErrors.confirmNewPassword}</p>}
                </label>
                <button type="submit" disabled={profileLoading}>
                  {profileLoading ? 'Updating...' : 'Update Profile'}
                </button>
              </form>
            </section>
          )}

          {/* Task Creation Section - Hide if profile settings are shown */}
          {!showProfileSettings && (
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
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Cancel Subtask
                  </button>
                )}
              </form>
            </section>
          )}

          {/* Task List Section - Hide if profile settings are shown */}
          {!showProfileSettings && (
            <section className="task-list-section">
              <h2>Your Tasks</h2>
              {error && <p className="error-message">{error}</p>} {/* General list error */}

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
              {!loading && taskTree.length === 0 && <p>No tasks found matching your criteria.</p>}

              <ul className="task-list">
                {taskTree.map(task => renderTask(task))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete the task:</p>
            <p className="modal-task-title">"{taskToDelete.title}"?</p>
            <p>
              {taskToDelete.children && taskToDelete.children.length > 0
                ? "This will also delete all its subtasks."
                : "This action cannot be undone."}
            </p>
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