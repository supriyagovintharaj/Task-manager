const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

  }

  async sendDailySummary(userEmail, summaryData) {
    try {
      const { completedTasks, pendingTasks, xpEarned, level, streak } = summaryData;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .stat { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 8px; text-align: center; min-width: 100px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #4F46E5; }
            .stat-label { font-size: 14px; color: #666; }
            .task-list { margin: 20px 0; }
            .task { padding: 10px; margin: 5px 0; background: white; border-radius: 4px; border-left: 4px solid #4F46E5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Your Daily Task Summary</h1>
              <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div class="content">
              <div style="text-align: center; margin: 20px 0;">
                <div class="stat">
                  <div class="stat-value">${completedTasks.length}</div>
                  <div class="stat-label">Tasks Completed</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${pendingTasks.length}</div>
                  <div class="stat-label">Tasks Pending</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${xpEarned}</div>
                  <div class="stat-label">XP Earned</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${level}</div>
                  <div class="stat-label">Current Level</div>
                </div>
              </div>

              ${completedTasks.length > 0 ? `
                <h3>✅ Completed Today</h3>
                <div class="task-list">
                  ${completedTasks.map(task => `
                    <div class="task">
                      <strong>${task.title}</strong>
                      <span style="float: right; color: #10B981;">+${task.xp} XP</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${pendingTasks.length > 0 ? `
                <h3>⏳ Still Pending</h3>
                <div class="task-list">
                  ${pendingTasks.slice(0, 5).map(task => `
                    <div class="task">
                      <strong>${task.title}</strong>
                      <span style="float: right; color: #F59E0B;">${task.priority} priority</span>
                    </div>
                  `).join('')}
                  ${pendingTasks.length > 5 ? `<p>...and ${pendingTasks.length - 5} more tasks</p>` : ''}
                </div>
              ` : ''}

              <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 8px; text-align: center;">
                <h3>🎯 Tomorrow's Goal</h3>
                <p>Keep up the momentum! Try to complete at least 3 tasks tomorrow.</p>
                ${streak > 0 ? `<p>🔥 Current streak: ${streak} days!</p>` : ''}
              </div>
            </div>

            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
              <p>This is an automated summary from Smart Task Manager</p>
              <p>You can disable these emails in your preferences</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `📊 Daily Summary - ${completedTasks.length} tasks completed!`,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Daily summary email sent to:', userEmail);
      return true;
    } catch (error) {
      console.error('Error sending daily summary email:', error);
      return false;
    }
  }

  async sendTaskReminder(userEmail, task) {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .task { padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #F59E0B; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Task Reminder</h1>
            </div>
            
            <div class="content">
              <div class="task">
                <h3>${task.title}</h3>
                <p>${task.description || 'No description provided'}</p>
                <p><strong>Priority:</strong> ${task.priority}</p>
                <p><strong>Energy Level:</strong> ${task.energy}</p>
                ${task.dueDate ? `<p><strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <p>Don't let this task slip away! Complete it to earn ${task.xp} XP.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `⏰ Reminder: ${task.title}`,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Task reminder email sent to:', userEmail);
      return true;
    } catch (error) {
      console.error('Error sending task reminder email:', error);
      return false;
    }
  }

  async sendLevelUpNotification(userEmail, userData) {
    try {
      const { name, level, xp, newBadge } = userData;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10B981; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; text-align: center; }
            .celebration { font-size: 48px; margin: 20px 0; }
            .badge { display: inline-block; padding: 15px 25px; background: #FCD34D; color: #92400E; border-radius: 25px; font-weight: bold; margin: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="celebration">🎉🎊🏆</div>
              <h1>Congratulations, ${name}!</h1>
              <h2>You've reached Level ${level}!</h2>
            </div>
            
            <div class="content">
              <p style="font-size: 18px; margin: 20px 0;">
                Amazing work! Your dedication has paid off.
              </p>
              
              <div style="margin: 30px 0;">
                <div class="badge">${newBadge}</div>
              </div>
              
              <p><strong>Total XP:</strong> ${xp}</p>
              <p><strong>Current Level:</strong> ${level}</p>
              
              <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 8px;">
                <h3>🚀 Keep Going!</h3>
                <p>You're on fire! Keep completing tasks to reach the next level.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `🏆 Level Up! You've reached Level ${level}!`,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Level up email sent to:', userEmail);
      return true;
    } catch (error) {
      console.error('Error sending level up email:', error);
      return false;
    }
  }
}

module.exports = new EmailService();