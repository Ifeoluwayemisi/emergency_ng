import { prisma } from "../utils/prisma.js";
import { enqueueNotification } from "../queues/notificationQueue.js";

export const emergencyService = {
  createEmergency: async (userId, data) => {
    return prisma.emergency.create({
      data: { userId, ...data, status: "pending" },
    });
  },

  notifyRespondersAndAdmins: async (emergency) => {
    // fetch responders (verified) nearby
    const responders = await prisma.user.findMany({
      where: { role: "RESPONDER", verified: true },
    });

    for (const r of responders) {
      const notif = await prisma.notification.create({
        data: {
          emergencyId: emergency.id,
          recipientId: r.id,
          channel: "TERMII_SMS",
        },
      });
      await enqueueNotification({
        notificationId: notif.id,
        emergencyId: emergency.id,
        recipientId: r.id,
        payload: {
          title: "New emergency near you",
          body: emergency.description,
          sms: `Emergency: ${emergency.description} @ ${emergency.latitude},${emergency.longitude}`,
        },
      });
    }

    // admin notifications
    const adminPhones = (process.env.ADMIN_PHONES || "").split(",");
    for (const phone of adminPhones) {
      const notif = await prisma.notification.create({
        data: {
          emergencyId: emergency.id,
          recipientId: null,
          channel: "TERMII_SMS",
          meta: { adminPhone: phone },
        },
      });
      await enqueueNotification({
        notificationId: notif.id,
        emergencyId: emergency.id,
        recipientId: null,
        payload: {
          title: "ADMIN ALERT",
          body: emergency.description,
          sms: `ADMIN ALERT: ${emergency.description}`,
        },
      });
    }
  },
};