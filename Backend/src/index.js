import Fastify from "fastify";
import cors from "fastify-cors";
import jwt from "fastify-jwt";
import websocket from "fastify-websocket";
import multipart from "fastify-multipart";
import dotenv from "dotenv";

dotenv.config();

const fastify = Fastify({ logger: true});

//plugins
await fastify.register(cors, {origin: '*'});
await fastify.register(jwt, { secret: process.env.JWT_SECRET });
await fastify.register(multipart);
await fastify.register(websocket)

//root route
fastify.get("/", async (request, reply) => {
  return { message: "RapidAid Backend is Running" };
});

// TODO: 
//  

const PORT = process.env.PORT || 4000;
fastify.listen({ port: PORT}, (err, address) => {
    if (err) throw err;
    console.log(`Server running at ${address}`)
})