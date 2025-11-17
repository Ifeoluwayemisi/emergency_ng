export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export function authorizeRoles(...roles) {
  return async (request, reply) => {
    const { role } = request.user;
    if (!roles.includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}