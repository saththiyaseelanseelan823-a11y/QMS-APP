const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a counter name'],
      trim: true
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Please associate a counter with a branch']
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    activeService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null
    },
    status: {
      type: String,
      enum: ['Active', 'Offline', 'On Break'],
      default: 'Offline'
    },
    currentTicketNumber: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate counter names within the same branch
CounterSchema.index({ name: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('Counter', CounterSchema);
