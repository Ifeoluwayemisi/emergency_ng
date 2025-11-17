import { signup, login } from "../controllers/authController.js";

export default async function authRoutes(fastify) {
  fastify.post("signup", signup);
  fastify.post("/login", login);
}
