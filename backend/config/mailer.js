const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify SMTP connection config
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP connection verification failed:', error.message);
    } else {
      console.log('SMTP Mail Server ready to send notifications.');
    }
  });
} else {
  console.warn('SMTP Mail Server credentials missing. Email service running in fallback/logging mode.');
}

module.exports = {
  transporter,
  from: process.env.SMTP_FROM || 'Antigravity Queue <noreply@antigravityqms.com>'
};
