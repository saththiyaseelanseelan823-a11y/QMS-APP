const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

let client = null;

if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log('Twilio SMS Client initialized.');
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error.message);
  }
} else {
  console.warn('Twilio credentials missing. SMS service running in fallback/logging mode.');
}

module.exports = {
  client,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
};
