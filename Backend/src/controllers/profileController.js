import { prisma } from "../utils/prisma.js";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

export async function getProfile(request, reply) {
  const userId = request.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  reply.send(user);
}

export async function updateProfile(request, reply) {
  const userId = request.user.id;
  const { name, phone, location } = request.body;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name, phone, location },
  });
  reply.send(updated);
}

export async function uploadProfileImage(request, reply) {
  const userId = request.user.id;
  const data = await request.file(); // fastify-multipart
  const uploadDir = path.join(process.cwd(), "/uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  const filename = `${userId}_${Date.now()}_${data.filename}`;
  const filepath = path.join(uploadDir, filename);

  await data.toBuffer().then((buffer) => fs.writeFileSync(filepath, buffer));

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { profileImg: `/uploads/${filename}` },
  });

  reply.send(updated);
}

import { profileService } from "../services/profileService.js";

export const updateProfile = async (req, res) => {
  try {
    const updated = await profileService.updateProfile(
      req.user.id,
      req.body,
      req.file
    );
    res.json({ message: "Profile updated", profile: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyResponder = async (req, res) => {
  try {
    const verified = await profileService.fakeVerifyResponder(req.params.id);
    res.json({ message: "Responder verified (demo)", verified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//TODO: Fake verification endpoint (toggle verified for hackathon)
export async function verifyResponder(request, reply) {
  const { userId } = request.body; // admin triggers this in v2, here we fake
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { verified: true },
  });
  reply.send(updated);
}