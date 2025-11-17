import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  verifyResponder,
} from "../controllers/profileController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

export default async function profileRoutes(fastify) {
  fastify.get("/", { preHandler: [authenticate] }, getProfile);
  fastify.patch("/", { preHandler: [authenticate] }, updateProfile);
  fastify.post("/photo", { preHandler: [authenticate] }, uploadProfileImage);
  fastify.patch(
    "/verify",
    { preHandler: [authenticate, authorizeRoles("RESPONDER")] },
    verifyResponder
  );
}