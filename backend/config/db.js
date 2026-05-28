const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/antigravity_qms');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Retry connection after 5 seconds if connection fails
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Monitor mongoose connection events
mongoose.connection.on('disconnected', () => {
  console.warn('Mongoose connection disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error(`Mongoose error: ${err.message}`);
});

module.exports = connectDB;
