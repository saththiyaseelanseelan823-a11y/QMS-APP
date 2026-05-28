const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a shift name'],
      trim: true
    },
    hours: {
      type: String,
      required: [true, 'Please specify shift hours (e.g. 08:00 - 13:00)'],
      trim: true
    },
    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please associate an officer with this shift']
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Please associate a branch with this shift']
    },
    days: {
      type: [String],
      required: [true, 'Please provide shift active days (e.g. Monday, Tuesday)']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Shift', ShiftSchema);
