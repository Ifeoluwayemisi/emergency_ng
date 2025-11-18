import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  toggleResponderVerification,
} from "../controllers/profileController.js";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";

export default async function profileRoutes(fastify) {
  // Fetch own profile
  fastify.get("/", { preHandler: [authenticate] }, getProfile);

  // Update own profile
  fastify.patch("/", { preHandler: [authenticate] }, updateProfile);

  // Upload profile photo
  fastify.post("/photo", { preHandler: [authenticate] }, uploadProfileImage);

  // Admin-only: toggle verification for responders
  fastify.patch(
    "/verify",
    {
      preHandler: [authenticate, authorizeRoles("ADMIN")], // restrict to admins
    },
    toggleResponderVerification
  );
}