import {
  createEmergency,
  getEmergency,
  cancelEmergency,
  responderAccept,
  responderReject,
} from "../controllers/emergencyController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

export default async function emergencyRoutes(fastify) {
  fastify.post("/", { preHandler: [authenticate] }, createEmergency);
  fastify.get("/:id", { preHandler: [authenticate] }, getEmergency);
  fastify.post("/:id/cancel", { preHandler: [authenticate] }, cancelEmergency);

  // responder actions
  fastify.post("/:id/accept", { preHandler: [authenticate] }, responderAccept);
  fastify.post("/:id/reject", { preHandler: [authenticate] }, responderReject);

  // optional: list incoming emergencies for a responder
  fastify.get(
    "/incoming/list",
    { preHandler: [authenticate] },
    async (req, rep) => {
      const userId = req.user.id;
      const list = await prisma.responderEmergency.findMany({
        where: { responderId: userId, accepted: false },
        include: { emergency: true },
      });
      rep.send(list);
    }
  );
}