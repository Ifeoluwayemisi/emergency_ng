import { Queue } from "bullmq";
import IORedis from "ioredis";
const connection = new IORedis(process.env.REDIS_URL);
export const notificationQueue = new Queue("notifications", { connection });

export const enqueueNotification = async (jobData) => {
  await notificationQueue.add("send-notification", jobData, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
  });
};
