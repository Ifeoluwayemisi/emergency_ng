// src/workers/notificationWorker.js
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { sendMultiChannelNotification } from "../services/notificationService.js";
import { prisma } from "../utils/prisma.js";

const connection = new IORedis(process.env.REDIS_URL);

const worker = new Worker(
  "notifications",
  async (job) => {
    const { notificationId, emergencyId, recipientId, payload } = job.data;
    // call service that attempts channels in sequence, logs attempts and returns final status
    const result = await sendMultiChannelNotification({
      notificationId,
      emergencyId,
      recipientId,
      payload,
    });
    // option: update notification status
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: result.success ? "SENT" : "FAILED" },
    });
    return result;
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error("Notification job failed", job.id, err);
});

export default worker;
