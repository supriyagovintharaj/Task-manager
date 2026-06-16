const express = require('express');
const { Task, User } = require('../models/user');
const auth = require('../middleware/auth');
const emailService = require('../services/emailservice');

const router = express.Router();

// Get analytics dashboard data
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { period = '7d' } = req.query;

    let startDate;
    switch (period) {
      case '1d':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get tasks in the specified period
    const tasks = await Task.find({
      user: userId,
      createdAt: { $gte: startDate }
    }).sort({ createdAt: 1 });

    // Calculate daily completion stats
    const dailyStats = [];
    const days = Math.ceil((Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate >= dayStart && taskDate <= dayEnd;
      });

      const completedTasks = dayTasks.filter(task => task.completed);

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        total: dayTasks.length,
        completed: completedTasks.length,
        pending: dayTasks.length - completedTasks.length,
        xpEarned: completedTasks.reduce((sum, task) => sum + task.xp, 0)
      });
    }

    // Priority distribution
    const priorityStats = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    };

    // Energy distribution
    const energyStats = {
      high: tasks.filter(t => t.energy === 'high').length,
      medium: tasks.filter(t => t.energy === 'medium').length,
      low: tasks.filter(t => t.energy === 'low').length
    };

    // Completion rate by priority
    const completionByPriority = {
      high: {
        total: priorityStats.high,
        completed: tasks.filter(t => t.priority === 'high' && t.completed).length
      },
      medium: {
        total: priorityStats.medium,
        completed: tasks.filter(t => t.priority === 'medium' && t.completed).length
      },
      low: {
        total: priorityStats.low,
        completed: tasks.filter(t => t.priority === 'low' && t.completed).length
      }
    };

    // Procrastination insights
    const postponedTasks = tasks.filter(t => t.postponeCount > 0);
    const avgPostponeCount = postponedTasks.length > 0 
      ? postponedTasks.reduce((sum, t) => sum + t.postponeCount, 0) / postponedTasks.length 
      : 0;

    // Overall stats
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;
    const totalXP = tasks.filter(t => t.completed).reduce((sum, task) => sum + task.xp, 0);

    res.json({
      period,
      dailyStats,
      overview: {
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        completionRate: parseFloat(completionRate),
        totalXP
      },
      distributions: {
        priority: priorityStats,
        energy: energyStats
      },
      completionByPriority,
      insights: {
        postponedTasks: postponedTasks.length,
        avgPostponeCount: Math.round(avgPostponeCount * 10) / 10,
        autoSplitTasks: tasks.filter(t => t.isAutoSplit).length,
        mostProductiveDay: dailyStats.reduce((max, day) => 
          day.completed > (max?.completed || 0) ? day : max, null
        )?.day || 'N/A'
      }
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get productivity trends
router.get('/trends', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const tasks = await Task.find({
      user: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Weekly trends (last 4 weeks)
    const weeklyTrends = [];
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(Date.now() - (week + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(Date.now() - week * 7 * 24 * 60 * 60 * 1000);

      const weekTasks = tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate >= weekStart && taskDate < weekEnd;
      });

      const completedWeekTasks = weekTasks.filter(t => t.completed);

      weeklyTrends.unshift({
        week: `Week ${4 - week}`,
        total: weekTasks.length,
        completed: completedWeekTasks.length,
        xp: completedWeekTasks.reduce((sum, task) => sum + task.xp, 0)
      });
    }

    // Time-based patterns
    const hourlyPattern = Array(24).fill(0);
    const dayOfWeekPattern = Array(7).fill(0);

    tasks.forEach(task => {
      const taskDate = new Date(task.createdAt);
      hourlyPattern[taskDate.getHours()]++;
      dayOfWeekPattern[taskDate.getDay()]++;
    });

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    res.json({
      weeklyTrends,
      patterns: {
        hourly: hourlyPattern.map((count, hour) => ({
          hour: `${hour}:00`,
          tasks: count
        })),
        dayOfWeek: dayOfWeekPattern.map((count, day) => ({
          day: daysOfWeek[day],
          tasks: count
        }))
      }
    });
  } catch (error) {
    console.error('Analytics trends error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send daily summary email
router.post('/daily-summary', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.preferences.emailNotifications || !user.preferences.dailySummary) {
      return res.status(400).json({ 
        error: 'Email notifications or daily summary not enabled' 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's tasks
    const todayTasks = await Task.find({
      user: req.userId,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const completedTasks = todayTasks.filter(t => t.completed);
    const pendingTasks = todayTasks.filter(t => !t.completed);
    const xpEarned = completedTasks.reduce((sum, task) => sum + task.xp, 0);

    // Calculate streak
    let streak = user.streaks?.current || 0;

    const summaryData = {
      completedTasks,
      pendingTasks,
      xpEarned,
      level: user.level,
      streak
    };

    const emailSent = await emailService.sendDailySummary(user.email, summaryData);

    if (emailSent) {
      res.json({ message: 'Daily summary email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Daily summary email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
