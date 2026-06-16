import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Mic, MicOff, Edit2, Trash2, Check, Star, Zap, Brain, Trophy, BarChart3, Settings, User, LogOut, Lock, Mail, Eye, EyeOff, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Mock data for demo
const INITIAL_TASKS = [
  { id: 1, title: 'Complete project proposal', description: 'Write urgent project proposal for client', priority: 'high', completed: false, energy: 'high', xp: 50, createdAt: new Date(), postponeCount: 0 },
  { id: 2, title: 'Buy groceries', description: 'Get weekly groceries from store', priority: 'medium', completed: true, energy: 'low', xp: 20, createdAt: new Date(Date.now() - 86400000), postponeCount: 0 },
  { id: 3, title: 'Review team performance', description: 'Monthly team review meeting', priority: 'high', completed: false, energy: 'medium', xp: 40, createdAt: new Date(), postponeCount: 1 }
];

// Create demo user if not exists
const createDemoUser = () => {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const demoUser = {
    id: 'demo-user',
    email: 'demo@example.com',
    name: 'Demo User',
    password: 'demo123',
    createdAt: new Date().toISOString(),
    xp: 150,
    level: 2
  };
  
  if (!users.find(u => u.email === demoUser.email)) {
    users.push(demoUser);
    localStorage.setItem('users', JSON.stringify(users));
  }
};

const SmartTaskManager = () => {
  // Initialize demo user
  useEffect(() => {
    createDemoUser();
  }, []);

  // Authentication state
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authData, setAuthData] = useState({ email: '', password: '', name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Existing state
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', energy: 'medium' });
  const [isListening, setIsListening] = useState(false);
  const [currentView, setCurrentView] = useState('tasks');
  const [userEnergy, setUserEnergy] = useState('medium');
  const [userXP, setUserXP] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const recognition = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const smartTask = analyzeTaskInput(transcript);
        setNewTask(prev => ({
          ...prev,
          title: transcript,
          ...smartTask
        }));
        setIsListening(false);
      };

      recognition.current.onerror = () => setIsListening(false);
      recognition.current.onend = () => setIsListening(false);
    }
  }, []);

  // Authentication functions
  const authenticateUser = useCallback(async (email, password, isSignup = false, name = '') => {
    setIsLoading(true);
    setAuthError('');
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (isSignup) {
        // Check if user already exists
        const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
        if (existingUsers.find(u => u.email === email)) {
          throw new Error('User already exists with this email');
        }
        
        // Create new user
        const newUser = {
          id: Date.now().toString(),
          email,
          name,
          password, // In real app, this would be hashed
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1
        };
        
        existingUsers.push(newUser);
        localStorage.setItem('users', JSON.stringify(existingUsers));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        setUser(newUser);
        setUserXP(0);
        setUserLevel(1);
        setTasks([]);
      } else {
        // Login existing user
        const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const foundUser = existingUsers.find(u => u.email === email && u.password === password);
        
        if (!foundUser) {
          throw new Error('Invalid email or password');
        }
        
        localStorage.setItem('currentUser', JSON.stringify(foundUser));
        setUser(foundUser);
        setUserXP(foundUser.xp || 0);
        setUserLevel(foundUser.level || 1);
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('currentUser');
    setUser(null);
    setTasks([]);
    setUserXP(0);
    setUserLevel(1);
    setCurrentView('tasks');
    setShowDailySummary(false);
    setAuthData({ email: '', password: '', name: '' });
    setAuthError('');
  }, []);

  // Memoized input change handlers
  const handleEmailChange = useCallback((e) => {
    setAuthData(prev => ({ ...prev, email: e.target.value }));
  }, []);

  const handlePasswordChange = useCallback((e) => {
    setAuthData(prev => ({ ...prev, password: e.target.value }));
  }, []);

  const handleNameChange = useCallback((e) => {
    setAuthData(prev => ({ ...prev, name: e.target.value }));
  }, []);

  const togglePasswordVisibility = useCallback((e) => {
    e.preventDefault();
    setShowPassword(prev => !prev);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    authenticateUser(
      authData.email, 
      authData.password, 
      authMode === 'signup',
      authData.name
    );
  }, [authData.email, authData.password, authMode, authData.name, authenticateUser]);

  const toggleAuthMode = useCallback(() => {
    setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
    setAuthError('');
    setAuthData({ email: '', password: '', name: '' });
  }, []);

  const fillDemoCredentials = useCallback(() => {
    setAuthData({ email: 'demo@example.com', password: 'demo123', name: '' });
  }, []);

  // Load user and tasks from memory on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setUserXP(userData.xp || 0);
      setUserLevel(userData.level || 1);
      
      // Load user-specific tasks
      const userTasksKey = `smartTasks_${userData.id}`;
      const savedTasks = localStorage.getItem(userTasksKey);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else if (userData.id === 'demo-user') {
        setTasks(INITIAL_TASKS);
      }
    }
  }, []);

  // Save to memory whenever tasks or user data changes
  useEffect(() => {
    if (user) {
      const userTasksKey = `smartTasks_${user.id}`;
      localStorage.setItem(userTasksKey, JSON.stringify(tasks));
      
      // Update user data
      const updatedUser = { ...user, xp: userXP, level: userLevel };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Update in users array
      const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const userIndex = existingUsers.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        existingUsers[userIndex] = updatedUser;
        localStorage.setItem('users', JSON.stringify(existingUsers));
      }
    }
  }, [tasks, userXP, userLevel, user]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show daily summary on app load (only for authenticated users)
  useEffect(() => {
    if (user) {
      const lastSummaryDate = localStorage.getItem(`lastSummaryDate_${user.id}`);
      const today = new Date().toDateString();
      
      if (lastSummaryDate !== today) {
        setTimeout(() => setShowDailySummary(true), 1000);
        localStorage.setItem(`lastSummaryDate_${user.id}`, today);
      }
    }
  }, [user]);

  const analyzeTaskInput = (input) => {
    const text = input.toLowerCase();
    let priority = 'medium';
    let energy = 'medium';

    // Priority detection
    if (text.includes('urgent') || text.includes('asap') || text.includes('important') || text.includes('critical')) {
      priority = 'high';
    } else if (text.includes('later') || text.includes('someday') || text.includes('maybe')) {
      priority = 'low';
    }

    // Energy level detection
    if (text.includes('quick') || text.includes('easy') || text.includes('simple')) {
      energy = 'low';
    } else if (text.includes('complex') || text.includes('difficult') || text.includes('challenging')) {
      energy = 'high';
    }

    return { priority, energy };
  };

  const startListening = () => {
  if (!recognition.current) return;
  if (isListening) {
    recognition.current.stop(); // Stop any ongoing session
    setIsListening(false);
    setTimeout(() => {
      setIsListening(true);
      recognition.current.start();
    }, 200); // Small delay to allow reset
  } else {
    setIsListening(true);
    recognition.current.start();
  }
};

  const addTask = () => {
    if (!newTask.title.trim()) return;

    const task = {
      id: Date.now(),
      ...newTask,
      completed: false,
      createdAt: new Date(),
      postponeCount: 0,
      xp: newTask.priority === 'high' ? 50 : newTask.priority === 'medium' ? 30 : 20
    };

    setTasks(prev => [task, ...prev]);
    setNewTask({ title: '', description: '', priority: 'medium', energy: 'medium' });
  };

  const toggleTask = (id) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        const updatedTask = { ...task, completed: !task.completed };
        if (!task.completed && updatedTask.completed) {
          setUserXP(prevXP => {
            const newXP = prevXP + task.xp;
            const newLevel = Math.floor(newXP / 100) + 1;
            if (newLevel > userLevel) setUserLevel(newLevel);
            return newXP;
          });
        } else if (task.completed && !updatedTask.completed) {
          // If unchecking, subtract XP
          setUserXP(prevXP => Math.max(0, prevXP - task.xp));
          const newLevel = Math.floor(Math.max(0, userXP - task.xp) / 100) + 1;
          if (newLevel < userLevel) setUserLevel(newLevel);
        }
        return updatedTask;
      }
      return task;
    }));
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const postponeTask = (id) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        const updatedTask = { ...task, postponeCount: task.postponeCount + 1 };
        
        // Anti-procrastination: auto-split after 2 postponements
        if (updatedTask.postponeCount >= 2) {
          const subtasks = splitTaskIntoSubtasks(task.title);
          updatedTask.description = `Auto-split: ${subtasks.join(', ')}`;
        }
        
        return updatedTask;
      }
      return task;
    }));
  };

  const updateTask = (id, updates) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, ...updates } : task
    ));
    setEditingTask(null);
  };

  const splitTaskIntoSubtasks = (title) => {
    // Simple task splitting logic
    if (title.toLowerCase().includes('report')) {
      return ['Write introduction', 'Research content', 'Write conclusion'];
    } else if (title.toLowerCase().includes('project')) {
      return ['Plan project', 'Execute main tasks', 'Review and finalize'];
    } else {
      return ['Break down task', 'Complete first part', 'Finish remaining work'];
    }
  };

  const getTasksForEnergyLevel = () => {
    return tasks.filter(task => !task.completed && task.energy === userEnergy);
  };

  const getAnalyticsData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    }).reverse();

    const completedByDay = last7Days.map(day => ({
      day: day.slice(0, 3),
      completed: tasks.filter(task => 
        task.completed && new Date(task.createdAt).toDateString() === day
      ).length
    }));

    return completedByDay;
  };

  const getBadge = () => {
    if (userLevel >= 10) return '🥇 Gold Master';
    if (userLevel >= 5) return '🥈 Silver Achiever';
    if (userLevel >= 3) return '🥉 Bronze Warrior';
    return '🌟 Beginner';
  };

// Separate Authentication Component to prevent re-renders
const AuthenticationForm = ({ onAuthenticate }) => {
  const [localAuthMode, setLocalAuthMode] = useState('login');
  const [localAuthData, setLocalAuthData] = useState({ email: '', password: '', name: '' });
  const [localShowPassword, setLocalShowPassword] = useState(false);
  const [localAuthError, setLocalAuthError] = useState('');
  const [localIsLoading, setLocalIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalIsLoading(true);
    setLocalAuthError('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (localAuthMode === 'signup') {
        const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
        if (existingUsers.find(u => u.email === localAuthData.email)) {
          throw new Error('User already exists with this email');
        }
        
        const newUser = {
          id: Date.now().toString(),
          email: localAuthData.email,
          name: localAuthData.name,
          password: localAuthData.password,
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1
        };
        
        existingUsers.push(newUser);
        localStorage.setItem('users', JSON.stringify(existingUsers));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        onAuthenticate(newUser);
      } else {
        const existingUsers = JSON.parse(localStorage.getItem('users') || '[]');
        const foundUser = existingUsers.find(u => u.email === localAuthData.email && u.password === localAuthData.password);
        
        if (!foundUser) {
          throw new Error('Invalid email or password');
        }
        
        localStorage.setItem('currentUser', JSON.stringify(foundUser));
        onAuthenticate(foundUser);
      }
    } catch (error) {
      setLocalAuthError(error.message);
    } finally {
      setLocalIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Smart Task Manager</h1>
          <p className="text-gray-600">
            {localAuthMode === 'login' ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {localAuthMode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={localAuthData.name}
                onChange={(e) => setLocalAuthData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your full name"
                disabled={localIsLoading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={localAuthData.email}
                onChange={(e) => setLocalAuthData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                disabled={localIsLoading}
              />
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={localShowPassword ? "text" : "password"}
                required
                minLength="6"
                value={localAuthData.password}
                onChange={(e) => setLocalAuthData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                disabled={localIsLoading}
              />
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              <button
                type="button"
                onClick={() => setLocalShowPassword(!localShowPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                disabled={localIsLoading}
              >
                {localShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {localAuthMode === 'signup' && (
              <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
            )}
          </div>

          {localAuthError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {localAuthError}
            </div>
          )}

          <button
            type="submit"
            disabled={localIsLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {localIsLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {localAuthMode === 'login' ? 'Signing in...' : 'Creating account...'}
              </div>
            ) : (
              localAuthMode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setLocalAuthMode(localAuthMode === 'login' ? 'signup' : 'login');
              setLocalAuthError('');
              setLocalAuthData({ email: '', password: '', name: '' });
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            disabled={localIsLoading}
          >
            {localAuthMode === 'login' 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
          </button>
        </div>

        {localAuthMode === 'login' && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-center">
            <p className="text-xs text-gray-600 mb-1">Demo credentials:</p>
            <p className="text-xs font-mono text-gray-800">demo@example.com / demo123</p>
            <button
              onClick={() => setLocalAuthData({ email: 'demo@example.com', password: 'demo123', name: '' })}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
              disabled={localIsLoading}
            >
              Fill demo credentials
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

  const DailySummary = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">📊 Daily Summary</h3>
          <button 
            onClick={() => setShowDailySummary(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <p>✅ Completed: {tasks.filter(t => t.completed).length} tasks</p>
          <p>⏳ Pending: {tasks.filter(t => !t.completed).length} tasks</p>
          <p>⚡ XP Earned: {userXP} points</p>
          <p>🏆 Current Level: {userLevel}</p>
          <p>🎖️ Badge: {getBadge()}</p>
        </div>
        <button 
          onClick={() => setShowDailySummary(false)}
          className="w-full mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Got it!
        </button>
      </div>
    </div>
  );

  const EditTaskModal = () => {
    const [editData, setEditData] = useState(editingTask || {});

    if (!editingTask) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold">Edit Task</h3>
            <button 
              onClick={() => setEditingTask(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Task title..."
              value={editData.title || ''}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <textarea
              placeholder="Description..."
              value={editData.description || ''}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
            
            <div className="flex gap-2">
              <select
                value={editData.priority || 'medium'}
                onChange={(e) => setEditData(prev => ({ ...prev, priority: e.target.value }))}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              
              <select
                value={editData.energy || 'medium'}
                onChange={(e) => setEditData(prev => ({ ...prev, energy: e.target.value }))}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low Energy</option>
                <option value="medium">Medium Energy</option>
                <option value="high">High Energy</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateTask(editingTask.id, editData)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TaskCard = ({ task }) => (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${
      task.priority === 'high' ? 'border-red-400' : 
      task.priority === 'medium' ? 'border-yellow-400' : 'border-green-400'
    } ${task.completed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
            {task.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-1 text-xs rounded ${
              task.priority === 'high' ? 'bg-red-100 text-red-700' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {task.priority}
            </span>
            <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
              {task.energy} energy
            </span>
            <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">
              {task.xp} XP
            </span>
            {task.postponeCount > 0 && (
              <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">
                Postponed {task.postponeCount}x
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => toggleTask(task.id)}
            className={`p-2 rounded ${task.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 hover:bg-green-100 hover:text-green-600'}`}
            title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            <Check size={16} />
          </button>
          {!task.completed && (
            <>
              <button
                onClick={() => postponeTask(task.id)}
                className="p-2 rounded bg-gray-100 hover:bg-yellow-100 hover:text-yellow-600"
                title="Postpone"
              >
                ⏰
              </button>
              <button
                onClick={() => setEditingTask(task)}
                className="p-2 rounded bg-gray-100 hover:bg-blue-100 hover:text-blue-600"
                title="Edit task"
              >
                <Edit2 size={16} />
              </button>
            </>
          )}
          <button
            onClick={() => deleteTask(task.id)}
            className="p-2 rounded bg-gray-100 hover:bg-red-100 hover:text-red-600"
            title="Delete task"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // If user is not authenticated, show auth form
  if (!user) {
    return <AuthenticationForm onAuthenticate={(userData) => {
      setUser(userData);
      setUserXP(userData.xp || 0);
      setUserLevel(userData.level || 1);
      
      // Load user-specific tasks
      const userTasksKey = `smartTasks_${userData.id}`;
      const savedTasks = localStorage.getItem(userTasksKey);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else if (userData.id === 'demo-user') {
        setTasks(INITIAL_TASKS);
      }
    }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Smart Task Manager</h1>
              {isOffline && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded">
                  Offline Mode
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium">Level {userLevel}</div>
                <div className="text-xs text-gray-500">{userXP} XP | {getBadge()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
                <button
                  onClick={logout}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
                  <User size={16} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6">
            {[
              { id: 'tasks', label: 'Tasks', icon: Plus },
              { id: 'energy', label: 'Energy Match', icon: Zap },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentView(id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  currentView === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {currentView === 'tasks' && (
          <div className="space-y-6">
            {/* Add Task */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Add New Task</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Task title..."
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                  />
                  <button
                    onClick={startListening}
                    disabled={!recognition.current}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      isListening ? 'bg-red-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Voice input"
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                </div>
                
                <textarea
                  placeholder="Description (optional)..."
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
                
                <div className="flex gap-4">
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  
                  <select
                    value={newTask.energy}
                    onChange={(e) => setNewTask(prev => ({ ...prev, energy: e.target.value }))}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low Energy</option>
                    <option value="medium">Medium Energy</option>
                    <option value="high">High Energy</option>
                  </select>
                  
                  <button
                    onClick={addTask}
                    disabled={!newTask.title.trim()}
                    className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Your Tasks</h2>
                <div className="text-sm text-gray-500">
                  {tasks.filter(t => !t.completed).length} pending • {tasks.filter(t => t.completed).length} completed
                </div>
              </div>
              {tasks.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <Plus size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
                  <p className="text-gray-500">Add your first task to get started!</p>
                </div>
              ) : (
                tasks.map(task => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        )}

        {currentView === 'energy' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="text-yellow-500" />
                Energy Matching
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Current Energy Level:</label>
                  <select
                    value={userEnergy}
                    onChange={(e) => setUserEnergy(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">🔋 Low Energy - Simple tasks</option>
                    <option value="medium">⚡ Medium Energy - Regular tasks</option>
                    <option value="high">🚀 High Energy - Complex tasks</option>
                  </select>
                </div>
                
                <div className="mt-6">
                  <h3 className="font-medium mb-3">Recommended Tasks for Your Energy Level:</h3>
                  <div className="space-y-3">
                    {getTasksForEnergyLevel().map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                  {getTasksForEnergyLevel().length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-4">
                        <Zap size={48} className="mx-auto" />
                      </div>
                      <p className="text-gray-500 italic">No tasks match your current energy level.</p>
                      <p className="text-sm text-gray-400 mt-2">Try changing your energy level or add new tasks.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="text-blue-500" />
                Analytics Dashboard
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Weekly Completion Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={getAnalyticsData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="completed" stroke="#3B82F6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="font-medium mb-3">Task Status</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Completed', value: tasks.filter(t => t.completed).length, fill: '#10B981' },
                          { name: 'Pending', value: tasks.filter(t => !t.completed).length, fill: '#F59E0B' }
                        ]}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{tasks.length}</div>
                  <div className="text-sm text-blue-700">Total Tasks</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{tasks.filter(t => t.completed).length}</div>
                  <div className="text-sm text-green-700">Completed</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{userXP}</div>
                  <div className="text-sm text-purple-700">Total XP</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">{userLevel}</div>
                  <div className="text-sm text-yellow-700">Current Level</div>
                </div>
              </div>

              {/* Additional Analytics */}
              <div className="mt-6 grid md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 mb-2">Productivity Score</h4>
                  <div className="text-2xl font-bold text-indigo-600">
                    {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2">Postponed Tasks</h4>
                  <div className="text-2xl font-bold text-orange-600">
                    {tasks.filter(t => t.postponeCount > 0).length}
                  </div>
                </div>
                <div className="bg-teal-50 p-4 rounded-lg">
                  <h4 className="font-medium text-teal-900 mb-2">High Priority</h4>
                  <div className="text-2xl font-bold text-teal-600">
                    {tasks.filter(t => t.priority === 'high' && !t.completed).length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showDailySummary && <DailySummary />}
      {editingTask && <EditTaskModal />}
      
      {/* Voice Recognition Indicator */}
      {isListening && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="animate-pulse">🎤</div>
          <span>Listening...</span>
        </div>
      )}
    </div>
  );
};

export default SmartTaskManager;