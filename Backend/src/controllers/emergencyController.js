import { prisma } from '../utils/prisma.js';
import { haversineDistance } from '../utils/geo.js';

const FIND_RADIUS_KM = 6; // choose 5-10km for hackathon

export async function createEmergency(request, reply) {
  try {
    const userId = request.user.id;
    const { description, category, latitude, longitude, address } = request.body;
    if (!latitude || !longitude) return reply.code(400).send({ error: 'latitude and longitude required' });

    // create emergency
    const emergency = await prisma.emergency.create({
      data: {
        userId,
        description,
        category,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address
      }
    });

    // find candidate responders (verified RESPONDERs with last known coords)
    const candidates = await prisma.user.findMany({
      where: {
        role: 'RESPONDER',
        verified: true,
        latitude: { not: null },
        longitude: { not: null }
      }
    });

    // compute distance and pick responders within radius, order by distance
    const respondersWithDistance = candidates
      .map(r => {
        const dist = haversineDistance(latitude, longitude, r.latitude, r.longitude);
        return { responder: r, distanceKm: dist };
      })
      .filter(x => x.distanceKm <= FIND_RADIUS_KM)
      .sort((a,b) => a.distanceKm - b.distanceKm);

    // pick top N responders (e.g., first 5)
    const selected = respondersWithDistance.slice(0, 6);

    // create ResponderEmergency rows
    const reRecords = await Promise.all(selected.map(s =>
      prisma.responderEmergency.create({
        data: {
          emergencyId: emergency.id,
          responderId: s.responder.id
        }
      })
    ));

    // Notify responders via websocket (and optionally SMS/email)
    const responderIds = selected.map(s => s.responder.id);
    const payload = {
      type: 'newEmergency',
      emergency: {
        id: emergency.id,
        description: emergency.description,
        category: emergency.category,
        latitude: emergency.latitude,
        longitude: emergency.longitude,
        address: emergency.address,
        createdAt: emergency.createdAt
      }
    };

    // broadcast
    request.server.broadcastToUsers(responderIds, payload);

    return reply.send({ emergency, notifiedResponders: responderIds });
  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: err.message });
  }
}

export async function getEmergency(request, reply) {
  const { id } = request.params;
  const emergency = await prisma.emergency.findUnique({
    where: { id: parseInt(id) },
    include: { responders: { include: { responder: true } }, user: true }
  });
  if (!emergency) return reply.code(404).send({ error: 'Not found' });
  reply.send(emergency);
}

export async function cancelEmergency(request, reply) {
  const { id } = request.params;
  const userId = request.user.id;
  const emergency = await prisma.emergency.findUnique({ where: { id: parseInt(id) } });
  if (!emergency) return reply.code(404).send({ error: 'Not found' });
  if (emergency.userId !== userId) return reply.code(403).send({ error: 'Not your emergency' });

  const updated = await prisma.emergency.update({
    where: { id: parseInt(id) },
    data: { status: 'CANCELLED' }
  });

  // notify responders in the room
  request.server.broadcastToRoom(id, { type: 'emergencyCancelled', emergencyId: id });

  reply.send(updated);
}

export async function responderAccept(request, reply) {
  const { id } = request.params; // emergency id
  const responderId = request.user.id;
  // update ResponderEmergency record
  const re = await prisma.responderEmergency.updateMany({
    where: { emergencyId: parseInt(id), responderId: responderId },
    data: { accepted: true, respondedAt: new Date() }
  });
  // set emergency status to ACCEPTED if needed
  const updatedEmergency = await prisma.emergency.update({
    where: { id: parseInt(id) },
    data: { status: 'ACCEPTED' }
  });

  // Notify emergency creator (user)
  const em = await prisma.emergency.findUnique({ where: { id: parseInt(id) } });
  request.server.sendToUser(em.userId, {
    type: 'responderAccepted',
    emergencyId: id,
    responderId
  });

  // Also notify other responders (optional) to stop trying
  request.server.broadcastToRoom(id, {
    type: 'responderAcceptedBroadcast',
    emergencyId: id,
    responderId
  });

  return reply.send({ success: true, updatedEmergency });
}

export async function responderReject(request, reply) {
  const { id } = request.params;
  const responderId = request.user.id;
  await prisma.responderEmergency.updateMany({
    where: { emergencyId: parseInt(id), responderId },
    data: { accepted: false, respondedAt: new Date() }
  });
  request.server.broadcastToRoom(id, { type: 'responderRejected', emergencyId: id, responderId });
  return reply.send({ success: true });
}
