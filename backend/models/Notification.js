const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null
    },
    recipient: {
      type: String,
      required: [true, 'Please specify a recipient email or phone number']
    },
    channel: {
      type: String,
      enum: ['SMS', 'WhatsApp', 'Email'],
      required: [true, 'Please specify the channel']
    },
    status: {
      type: String,
      enum: ['Pending', 'Sent', 'Failed'],
      default: 'Pending'
    },
    message: {
      type: String,
      required: [true, 'Please provide message content']
    },
    errorDetails: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', NotificationSchema);
