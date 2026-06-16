const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  energy: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  dueDate: Date,
  xp: {
    type: Number,
    default: function() {
      const xpMap = { low: 20, medium: 30, high: 50 };
      return xpMap[this.priority] || 30;
    }
  },
  postponeCount: {
    type: Number,
    default: 0
  },
  subtasks: [{
    title: String,
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  tags: [String],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isAutoSplit: {
    type: Boolean,
    default: false
  },
  originalTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }
}, {
  timestamps: true
});

// Indexes for better performance
taskSchema.index({ user: 1, completed: 1 });
taskSchema.index({ user: 1, createdAt: -1 });
taskSchema.index({ user: 1, priority: 1 });
taskSchema.index({ user: 1, energy: 1 });

// Auto-split task when postponed too many times
taskSchema.methods.autoSplit = function() {
  if (this.postponeCount >= 2 && !this.isAutoSplit) {
    const subtasks = this.generateSubtasks();
    this.subtasks = subtasks;
    this.isAutoSplit = true;
    return subtasks;
  }
  return null;
};

// Generate subtasks based on task title/description
taskSchema.methods.generateSubtasks = function() {
  const title = this.title.toLowerCase();
  let subtasks = [];

  if (title.includes('report') || title.includes('document')) {
    subtasks = [
      { title: 'Research and gather information' },
      { title: 'Create outline' },
      { title: 'Write first draft' },
      { title: 'Review and edit' },
      { title: 'Finalize document' }
    ];
  } else if (title.includes('project')) {
    subtasks = [
      { title: 'Plan project scope' },
      { title: 'Break down into phases' },
      { title: 'Execute main tasks' },
      { title: 'Review and test' },
      { title: 'Finalize and deliver' }
    ];
  } else if (title.includes('meeting') || title.includes('presentation')) {
    subtasks = [
      { title: 'Prepare agenda/outline' },
      { title: 'Create materials' },
      { title: 'Practice/rehearse' },
      { title: 'Conduct meeting/presentation' }
    ];
  } else {
    // Generic breakdown
    subtasks = [
      { title: 'Break down the task' },
      { title: 'Complete first part' },
      { title: 'Complete remaining work' },
      { title: 'Review and finalize' }
    ];
  }

  return subtasks;
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task; // <-- only export Task
