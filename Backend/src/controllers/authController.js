import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
({});
import { prisma } from "../utils/prisma.js";

export async function signup(request, reply) {
  try {
    const { name, email, password, role, phone, location } = request.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return reply.code(400).send({ error: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 7);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, phone, location },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "5d" }
    );
    reply.send({ user, token });
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
}

export async function login(request, reply) {
  try {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return reply
        .code(401)
        .send({
          error: "User not found! Please reguster or try another email address",
        });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return reply.code(401).send({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    reply.send({ user, token });
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
}
