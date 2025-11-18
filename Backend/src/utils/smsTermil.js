import axios from "axios";

export async function sendSMSTermii(phone, message) {
  try {
    const payload = {
      to: phone,
      from: process.env.TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel: "dnd",
      api_key: process.env.TERMII_API_KEY,
    };
    const r = await axios.post(
      "https://api.ng.termii.com/api/sms/send",
      payload
    );
    return { success: true, response: r.data };
  } catch (err) {
    return { success: false, error: err.response?.data || err.message };
  }
}