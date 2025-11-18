// src/services/notificationService.js
import { prisma } from "../utils/prisma.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendSMSTermii } from "../utils/sendSMSTermii.js";
import { sendSMSTwilio, sendWhatsAppTwilio } from "../utils/twilio.js";
import { sendFCMPush } from "../utils/fcm.js";

const CHANNEL_ORDER = [
  "EMAIL",
  "TERMII_SMS",
  "TWILIO_SMS",
  "WHATSAPP",
  "FCM_PUSH",
];

export async function sendMultiChannelNotification({
  notificationId,
  emergencyId,
  recipientId,
  payload,
}) {
  let success = false;
  let lastResponse = null;

  // fetch recipient details if provided
  const recipient = recipientId
    ? await prisma.user.findUnique({ where: { id: recipientId } })
    : null;

  for (const channel of CHANNEL_ORDER) {
    try {
      let res;
      if (channel === "EMAIL" && recipient?.email) {
        res = await sendEmail(
          recipient.email,
          payload.title,
          payload.html || payload.body
        );
      } else if (channel === "TERMII_SMS" && recipient?.phone) {
        res = await sendSMSTermii(recipient.phone, payload.sms || payload.body);
      } else if (channel === "TWILIO_SMS" && recipient?.phone) {
        res = await sendSMSTwilio(recipient.phone, payload.sms || payload.body);
      } else if (channel === "WHATSAPP" && recipient?.phone) {
        res = await sendWhatsAppTwilio(
          recipient.phone,
          payload.sms || payload.body
        );
      } else if (channel === "FCM_PUSH" && recipient?.fcmToken) {
        res = await sendFCMPush(recipient.fcmToken, {
          title: payload.title,
          body: payload.body,
          data: payload.extra || {},
        });
      } else {
        // channel not applicable; skip
        continue;
      }

      // log attempt
      await prisma.notificationAttempt.create({
        data: {
          notificationId,
          channel,
          success: !!res.success, // our helper should return { success: true/false, response, error }
          response: res.response || null,
          errorMessage: res.error || null,
        },
      });

      lastResponse = res;
      if (res.success) {
        success = true;
        break;
      } // stop if delivered
    } catch (err) {
      // log error attempt
      await prisma.notificationAttempt.create({
        data: {
          notificationId,
          channel,
          success: false,
          response: null,
          errorMessage: err.message,
        },
      });
      // continue to next channel
    }
  }

  return { success, lastResponse };
}