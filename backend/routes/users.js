const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Task } = require('../models/user');
const auth = require('../middleware/auth');
const emailService = require('../services/emailservice');

const router = express.Router();

// Get user profile with stats
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user task statistics
    const totalTasks = await Task.countDocuments({ user: req.userId });
    const completedTasks = await Task.countDocuments({ user: req.userId, completed: true });
    const pendingTasks = totalTasks - completedTasks;

    // Get recent achievements
    const recentBadges = user.badges
      .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
      .slice(0, 5);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        xp: user.xp,
        level: user.level,
        preferences: user.preferences,
        streaks: user.streaks,
        joinedAt: user.createdAt
      },
      stats: {
        totalTasks,
        completedTasks,
        pendingTasks,
        completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
      },
      recentBadges
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.patch('/profile', auth, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (req.body.email && req.body.email !== user.email) {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'email'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        xp: user.xp,
        level: user.level
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user badges
router.get('/badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('badges level xp');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Define available badges with unlock criteria
    const availableBadges = [
      { name: '🌟 First Steps', description: 'Complete your first task', unlocked: user.badges.some(b => b.name.includes('First Steps')) },
      { name: '🔥 Streak Master', description: 'Complete tasks for 7 days straight', unlocked: user.streaks?.longest >= 7 },
      { name: '⚡ Speed Demon', description: 'Complete 10 tasks in one day', unlocked: user.badges.some(b => b.name.includes('Speed Demon')) },
      { name: '🎯 Perfectionist', description: 'Complete 50 tasks with 100% accuracy', unlocked: user.badges.some(b => b.name.includes('Perfectionist')) },
      { name: '🏆 Champion', description: 'Reach level 10', unlocked: user.level >= 10 },
      { name: '💎 Diamond Elite', description: 'Reach level 20', unlocked: user.level >= 20 },
      { name: '🚀 Productivity Guru', description: 'Complete 100 tasks', unlocked: user.badges.some(b => b.name.includes('Productivity Guru')) }
    ];

    res.json({
      earnedBadges: user.badges.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)),
      availableBadges,
      totalXP: user.xp,
      currentLevel: user.level,
      nextLevelXP: (user.level * 100)
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user account
router.delete('/account', auth, async (req, res) => {
  try {
    // Delete all user's tasks
    await Task.deleteMany({ user: req.userId });
    
    // Delete user account
    await User.findByIdAndDelete(req.userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;