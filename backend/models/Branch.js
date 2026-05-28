const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a branch name'],
      unique: true,
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Please provide a branch address'],
      trim: true
    },
    region: {
      type: String,
      required: [true, 'Please provide a region'],
      trim: true
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Branch', BranchSchema);
