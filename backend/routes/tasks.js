const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Task, User } = require('../models/user');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all tasks for authenticated user
router.get('/', auth, [
  query('completed').optional().isBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high']),
  query('energy').optional().isIn(['low', 'medium', 'high']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      completed,
      priority,
      energy,
      page = 1,
      limit = 20,
      search
    } = req.query;

    // Build query
    const query = { user: req.userId };
    
    if (completed !== undefined) {
      query.completed = completed === 'true';
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (energy) {
      query.energy = energy;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('originalTask', 'title');

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new task
router.post('/', auth, [
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('energy').optional().isIn(['low', 'medium', 'high']),
  body('dueDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { title, description, priority, energy, dueDate, tags } = req.body;

    // Smart priority and energy detection
    const smartAnalysis = analyzeTaskInput(title + ' ' + (description || ''));

    const task = new Task({
      title,
      description,
      priority: priority || smartAnalysis.priority,
      energy: energy || smartAnalysis.energy,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags: tags || [],
      user: req.userId
    });

    await task.save();

    res.status(201).json({
      message: 'Task created successfully',
      task,
      smartSuggestions: smartAnalysis
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task
router.patch('/:id', auth, [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('energy').optional().isIn(['low', 'medium', 'high']),
  body('completed').optional().isBoolean(),
  body('dueDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const wasCompleted = task.completed;
    
    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        task[key] = req.body[key];
      }
    });

    // Handle completion
    if (!wasCompleted && task.completed) {
      task.completedAt = new Date();
      
      // Award XP to user
      const user = await User.findById(req.userId);
      if (user) {
        const leveledUp = user.addXP(task.xp);
        await user.save();
        
        if (leveledUp) {
          // Award level up badge
          user.badges.push({
            name: `Level ${user.level} Achiever`,
            earnedAt: new Date(),
            description: `Reached level ${user.level}!`
          });
          await user.save();
        }
      }
    } else if (wasCompleted && !task.completed) {
      task.completedAt = undefined;
    }

    await task.save();

    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Postpone task (increment postpone count)
router.patch('/:id/postpone', auth, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.completed) {
      return res.status(400).json({ error: 'Cannot postpone completed task' });
    }

    task.postponeCount += 1;

    // Auto-split if postponed too many times
    let subtasks = null;
    if (task.postponeCount >= 2 && !task.isAutoSplit) {
      subtasks = task.autoSplit();
    }

    await task.save();

    res.json({
      message: 'Task postponed',
      task,
      autoSplit: subtasks ? true : false,
      subtasks
    });
  } catch (error) {
    console.error('Postpone task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update subtask
router.patch('/:id/subtasks/:subtaskId', auth, [
  body('completed').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    subtask.completed = req.body.completed;
    
    // Check if all subtasks are completed
    const allSubtasksCompleted = task.subtasks.every(st => st.completed);
    if (allSubtasksCompleted && !task.completed) {
      task.completed = true;
      task.completedAt = new Date();
      
      // Award XP
      const user = await User.findById(req.userId);
      if (user) {
        user.addXP(task.xp);
        await user.save();
      }
    }

    await task.save();

    res.json({
      message: 'Subtask updated successfully',
      task
    });
  } catch (error) {
    console.error('Update subtask error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tasks matching user's energy level
router.get('/energy-match', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const energyLevel = req.query.energy || user.preferences.energyLevel;

    const tasks = await Task.find({
      user: req.userId,
      completed: false,
      energy: energyLevel
    }).sort({ priority: -1, createdAt: -1 });

    res.json({
      energyLevel,
      tasks,
      message: `Found ${tasks.length} tasks matching your ${energyLevel} energy level`
    });
  } catch (error) {
    console.error('Energy match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Smart task analysis function
function analyzeTaskInput(text) {
  const lowerText = text.toLowerCase();
  let priority = 'medium';
  let energy = 'medium';

  // Priority detection keywords
  const highPriorityWords = ['urgent', 'asap', 'important', 'critical', 'deadline', 'due today'];
  const lowPriorityWords = ['later', 'someday', 'maybe', 'when possible', 'eventually'];

  // Energy detection keywords
  const lowEnergyWords = ['quick', 'easy', 'simple', 'call', 'email', 'check'];
  const highEnergyWords = ['complex', 'difficult', 'challenging', 'create', 'develop', 'analyze', 'write report'];

  // Check priority
  if (highPriorityWords.some(word => lowerText.includes(word))) {
    priority = 'high';
  } else if (lowPriorityWords.some(word => lowerText.includes(word))) {
    priority = 'low';
  }

  // Check energy
  if (lowEnergyWords.some(word => lowerText.includes(word))) {
    energy = 'low';
  } else if (highEnergyWords.some(word => lowerText.includes(word))) {
    energy = 'high';
  }

  return { priority, energy };
}

module.exports = router;