const PREFIX = "session:";

export async function getSession(phone, env) {
  const session = await env.SESSIONS.get(`${PREFIX}${phone}`, "json");
  return session || null;
}

export async function saveSession(phone, session, env) {
  const ttl = Number(env.SESSION_TTL_SECONDS || 86400);
  await env.SESSIONS.put(
    `${PREFIX}${phone}`,
    JSON.stringify({ ...session, updatedAt: Date.now() }),
    { expirationTtl: Math.max(ttl, 60) }
  );
}

export async function clearSession(phone, env) {
  await env.SESSIONS.delete(`${PREFIX}${phone}`);
}
