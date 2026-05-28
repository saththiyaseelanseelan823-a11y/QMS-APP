const whatsappConfig = {
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  version: process.env.WHATSAPP_VERSION || 'v19.0',
  apiUrl: `https://graph.facebook.com/${process.env.WHATSAPP_VERSION || 'v19.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
};

if (!whatsappConfig.token || !whatsappConfig.phoneNumberId) {
  console.warn('WhatsApp Cloud API credentials missing. WhatsApp service running in fallback/logging mode.');
} else {
  console.log('WhatsApp Cloud API Client configured.');
}

module.exports = whatsappConfig;
