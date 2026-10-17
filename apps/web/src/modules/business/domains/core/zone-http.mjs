/**
 * Framework-neutral HTTP handler for ATLAS sovereign DNS.
 * Inject verified authentication, tenant membership authorization, and a
 * privileged server-side storage adapter. No client-provided actor/tenant trusted.
 */
import { normalizeZoneName, validateZoneChange } from "./zone.mjs";

function respond(status, body) {
  return {status, headers:{"content-type":"application/json","cache-control":"no-store"}, body:JSON.stringify(body)};
}
export function createDnsZoneHttpHandler({authenticate,authorize,storage}) {
  if (typeof authenticate !== "function" || typeof authorize !== "function" ||
      !storage || typeof storage.get !== "function" || typeof storage.commit !== "function")
    throw new Error("Trusted DNS dependencies required");
  return async function handle(request) {
    try {
      const principal = await authenticate(request);
      if (!principal || typeof principal.id !== "string" || !principal.id) return respond(401,{error:"unauthorized"});
      const tenantId = request?.params?.tenantId;
      const zone = normalizeZoneName(request?.params?.zoneName);
      // Membership and role resolution MUST be performed by trusted server code.
      if (typeof tenantId !== "string" || !await authorize({principal,tenantId,zone,action:request.method === "GET" ? "read" : "write"}))
        return respond(403,{error:"forbidden"});
      if (request.method === "GET") {
        const snapshot = await storage.get(tenantId,zone);
        return respond(200,{zone:snapshot ?? null});
      }
      if (request.method !== "PUT") return respond(405,{error:"method_not_allowed"});
      const payload = request.body;
      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          !Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 0)
        return respond(400,{error:"invalid_request"});
      const records = validateZoneChange(zone,payload.records);
      const snapshot = await storage.commit({
        tenantId,zone,actorId:principal.id,expectedVersion:payload.expectedVersion,records
      });
      return respond(200,{zone:snapshot});
    } catch (error) {
      if (error instanceof TypeError || /Invalid|Unsupported|TTL|priority|conflict|must belong|CNAME/.test(String(error.message))) {
        const conflict = /version conflict/.test(String(error.message));
        return respond(conflict ? 409 : 400,{error:conflict ? "version_conflict" : "invalid_request"});
      }
      // Do not expose storage internals or tokens in responses.
      return respond(503,{error:"service_unavailable"});
    }
  };
}
