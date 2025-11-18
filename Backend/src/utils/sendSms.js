// utils/sendSMS.js
import axios from "axios";

export const sendSMS = async (phone, message) => {
  try {
    const payload = {
      to: phone,
      from: process.env.TERMII_SENDER_ID,
      sms: message,
      type: "plain",
      channel: "dnd",
      api_key: process.env.TERMII_API_KEY,
    };

    await axios.post("https://api.ng.termii.com/api/sms/send", payload);

    return true;
  } catch (error) {
    console.error("SMS Error:", error.response?.data || error.message);
    return false;
  }
};
