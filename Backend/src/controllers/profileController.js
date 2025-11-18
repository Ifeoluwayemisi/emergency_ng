import { prisma } from "../utils/prisma.js";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

/* ---------- Config ---------- */
const UPLOAD_DIR = path.join(process.cwd(), "/uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

/* ---------- Helpers ---------- */
async function saveFile(file, prefix = "") {
  const filename = `${prefix}_${Date.now()}_${file.filename}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  // Use non-blocking write
  await pipeline(file.file, fs.createWriteStream(filepath));

  return `/uploads/${filename}`;
}

/* ---------- Controllers ---------- */

// Get current user profile
export async function getProfile(request, reply) {
  try {
    const userId = request.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    reply.send(user);
  } catch (err) {
    request.log?.error(err);
    reply.code(500).send({ error: "Failed to fetch profile" });
  }
}

// Update user profile (name, phone, location)
export async function updateProfile(request, reply) {
  try {
    const userId = request.user.id;
    const { name, phone, locationType } = request.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name, phone, locationType },
    });

    reply.send({ message: "Profile updated", profile: updated });
  } catch (err) {
    request.log?.error(err);
    reply.code(500).send({ error: "Failed to update profile" });
  }
}

// Upload profile image
export async function uploadProfileImage(request, reply) {
  try {
    const userId = request.user.id;
    const data = await request.file(); // fastify-multipart

    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    const filePath = await saveFile(data, `user_${userId}`);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { profileImg: filePath },
    });

    reply.send({ message: "Profile image updated", profile: updated });
  } catch (err) {
    request.log?.error(err);
    reply.code(500).send({ error: "Failed to upload profile image" });
  }
}

// Toggle responder verification (admin endpoint / demo)
export async function toggleResponderVerification(request, reply) {
  try {
    const { userId, verified } = request.body;

    if (!userId) return reply.code(400).send({ error: "userId is required" });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { verified: verified ?? true }, // default true if not specified
    });

    reply.send({
      message: `Responder verification updated`,
      user: updated,
    });
  } catch (err) {
    request.log?.error(err);
    reply.code(500).send({ error: "Failed to toggle verification" });
  }
}
