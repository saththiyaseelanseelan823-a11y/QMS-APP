const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please provide a service code'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Please provide a service name'],
      trim: true
    },
    avgWait: {
      type: Number,
      default: 15 // average waiting time in minutes
    },
    icon: {
      type: String,
      default: 'fa-concierge-bell'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Service', ServiceSchema);
