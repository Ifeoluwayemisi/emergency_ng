import { prisma } from "../utils/prisma.js";

export async function acceptEmergency(request, reply) {
  try {
    const responderId = request.user.id;
    const emergencyId = parseInt(request.params.id, 10);

    // transaction: ensure only one responder can accept
    const result = await prisma.$transaction(async (tx) => {
      const emergency = await tx.emergency.findUnique({
        where: { id: emergencyId },
      });
      if (!emergency) throw new Error("Emergency not found");
      if (emergency.status !== "PENDING")
        throw new Error("Emergency already taken");

      // mark responderEmergency accepted
      await tx.responderEmergency.updateMany({
        where: { emergencyId, responderId },
        data: { accepted: true, respondedAt: new Date() },
      });

      // set emergency accepted & set assigned responder (we can create an assigned field later)
      const updatedEmergency = await tx.emergency.update({
        where: { id: emergencyId },
        data: { status: "ACCEPTED" },
      });

      // set responder not available
      await tx.user.update({
        where: { id: responderId },
        data: { available: false },
      });

      return { updatedEmergency };
    });

    // notify emergency owner
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
      include: { user: true },
    });

    // notify via WS
    await request.server.wsSendToUser(String(emergency.userId), {
      type: "responder_accepted",
      emergencyId,
      responderId: String(responderId),
    });

    // broadcast to room so other responders stop trying
    await request.server.wsBroadcastToRoom(String(emergencyId), {
      type: "responderAcceptedBroadcast",
      emergencyId,
      responderId: String(responderId),
    });

    return reply.send({ success: true, emergency: result.updatedEmergency });
  } catch (err) {
    request.log.error(err);
    return reply.code(400).send({ error: err.message });
  }
}

export async function setAvailability(request, reply) {
  try {
    const userId = request.user.id;
    const { available, latitude, longitude } = request.body;

    const data = { available: Boolean(available) };
    if (typeof latitude === "number") data.latitude = latitude;
    if (typeof longitude === "number") data.longitude = longitude;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // Optionally notify system that responder is online/offline
    if (available) {
      // add to responders room so they can receive broadcasts if connected
      // if connected, ensure they are in room 'responders' (client should join room via ws)
    } else {
      // mark not available
    }

    return reply.send({ success: true, user: updated });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: err.message });
  }
}
