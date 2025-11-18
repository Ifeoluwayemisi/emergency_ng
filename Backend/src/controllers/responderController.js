import { prisma } from "../utils/prisma.js";

export const acceptEmergency = async (req, res) => {
  const { emergencyId } = req.body;
  const responderId = req.user.id;

  try {
    await prisma.emergency.update({
      where: { id: emergencyId },
      data: { responderId, status: "accepted" },
    });

    // emit WebSocket event to user
    req.io
      .to(`user_${emergencyId}`)
      .emit("responder_accepted", { emergencyId, responderId });

    res.json({ message: "Accepted emergency" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
