const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: [true, 'Please provide a ticket token number']
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Please associate ticket with a branch']
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Please associate ticket with a service']
    },
    customerName: {
      type: String,
      required: [true, 'Please provide customer name'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Please provide customer phone number'],
      trim: true
    },
    status: {
      type: String,
      enum: ['Waiting', 'Serving', 'Hold', 'Completed', 'No Show', 'Cancelled'],
      default: 'Waiting'
    },
    counterName: {
      type: String,
      default: ''
    },
    counter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      default: null
    },
    timeCreated: {
      type: Date,
      default: Date.now
    },
    timeServingStart: {
      type: Date,
      default: null
    },
    timeCompleted: {
      type: Date,
      default: null
    },
    priority: {
      type: Boolean,
      default: false
    },
    qrCode: {
      type: String,
      default: null
    },
    estimatedWait: {
      type: Number,
      default: 0 // waiting time in minutes
    }
  },
  {
    timestamps: true
  }
);

// Indexes for rapid queue state queries
TicketSchema.index({ branch: 1, status: 1 });
TicketSchema.index({ branch: 1, service: 1, status: 1 });

module.exports = mongoose.model('Ticket', TicketSchema);
