// Source-controlled deployment alias for the existing production telephony slug.
// Keep the implementation in one canonical handler; importing it registers
// the Deno.serve handler without duplicating provider or authorization logic.
// Deploy this function only after validating the target project's JWT policy.
import '../atlas-communication-telephony/index.ts';
