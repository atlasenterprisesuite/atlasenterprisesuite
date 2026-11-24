/**
 * Sovereign DNS server composition.
 * Only call from a trusted server process. The caller must inject a verified
 * JWT verifier and a database driver with server-only credentials.
 * The database must grant access to its dedicated restricted backend role.
 */
import { createDnsZoneHttpHandler } from "./zone-http.mjs";

export function createDnsZoneServer({verifyAccessToken,db}) {
  if (typeof verifyAccessToken !== "function" || !db ||
      typeof db.findActiveMembership !== "function" ||
      typeof db.readZone !== "function" || typeof db.commitZone !== "function")
    throw new Error("Trusted identity and database adapters required");

  return createDnsZoneHttpHandler({
    authenticate: async request => {
      const header = request?.headers?.authorization ?? request?.headers?.Authorization;
      if (typeof header !== "string" || !/^Bearer [^\s]+$/.test(header)) return null;
      const claims = await verifyAccessToken(header.slice(7));
      if (!claims || typeof claims.sub !== "string" || !claims.sub) return null;
      return {id:claims.sub};
    },
    authorize: async ({principal,tenantId,action}) => {
      const membership = await db.findActiveMembership({actorId:principal.id,tenantId});
      if (!membership || membership.status !== "active") return false;
      const role = String(membership.role ?? "").toLowerCase();
      return action === "read"
        ? ["owner","admin","dns_admin","member"].includes(role)
        : ["owner","admin","dns_admin"].includes(role);
    },
    storage: {
      get: async (tenantId,zone) => db.readZone({tenantId,zone}),
      commit: async ({tenantId,zone,actorId,expectedVersion,records}) =>
        db.commitZone({tenantId,zone,actorId,expectedVersion,records})
    }
  });
}
