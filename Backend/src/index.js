import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "fastify-jwt";
import websocket from "@fastify/websocket";
import multipart from "fastify-multipart";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoute.js";
import profileRoutes from "./routes/profileRoute.js";
import wsPlugin from "./plugins/wsHandler.js";
import emergencyRoutes from "./routes/emergencyRoute.js";

dotenv.config();

const fastify = Fastify({ logger: true });

//plugins
await fastify.register(cors, {
  origin: "*",
});
await fastify.register(jwt, { secret: process.env.JWT_SECRET });
await fastify.register(multipart);
await fastify.register(websocket);
await fastify.register(wsPlugin);

//root route
fastify.get("/", async (request, reply) => {
  return { message: "RapidAid Backend is Running" };
});

// TODO:
await fastify.register(authRoutes, { prefix: "/auth" });
await fastify.register(profileRoutes, { prefix: "/profile" });
await fastify.register(emergencyRoutes, {prefix: '/emergency'});
// fastify.register(firstAidRoutes, {prefix: 'first-aid'})

const PORT = process.env.PORT || 4000;
fastify.listen({ port: PORT }, (err, address) => {
  if (err) throw err;
  console.log(`Server running at ${address}`);
});
