import Twilio from 'twilio';
const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSMSTwilio(phone, message) {
  try {
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_SENDER_PHONE,
      to: phone
    });
    return { success: true, response: msg };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendWhatsAppTwilio(phone, message) {
  try {
    const msg = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER, // e.g. 'whatsapp:+1415...'
      to: `whatsapp:${phone}`,
      body: message
    });
    return { success: true, response: msg };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
