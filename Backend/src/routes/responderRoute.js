import {
  acceptEmergency,
  setAvailability,
} from "../controllers/responderController.js";
import { authenticate } from "../middlewares/auth.js";

export default async function responderRoutes(fastify) {
  fastify.post(
    "/emergency/:id/accept",
    { preHandler: [authenticate] },
    acceptEmergency
  );
  // add reject, incoming list, etc.
}
fastify.patch(
  "/responder/availability",
  { preHandler: [authenticate] },
  setAvailability
);
