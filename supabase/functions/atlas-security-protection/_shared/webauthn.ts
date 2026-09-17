import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from 'npm:@simplewebauthn/server@14.0.2';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from 'npm:@simplewebauthn/types@12.0.0';
import type { SecurityRequestContext } from './context.ts';
import { SecurityProtectionError } from './errors.ts';
import {
  consumeChallenge,
  createChallenge,
  getPasskeyByCredentialId,
  grantSecurityStepUp,
  listActivePasskeys,
  storeVerifiedPasskey,
  updatePasskeyCounter
} from './repository.ts';

export type WebAuthnConfig = {
  rpId: string;
  rpName: string;
  origin: string;
};

export function getWebAuthnConfig(): WebAuthnConfig {
  const rpId = Deno.env.get('ATLAS_WEBAUTHN_RP_ID') || '';
  const rpName = Deno.env.get('ATLAS_WEBAUTHN_RP_NAME') || '';
  const origin = Deno.env.get('ATLAS_WEBAUTHN_ORIGIN') || '';
  if (!rpId || !rpName || !origin) {
    throw new SecurityProtectionError('webauthn_not_configured', 503);
  }
  return { rpId, rpName, origin };
}

function userName(context: SecurityRequestContext): string {
  return String(context.user.email || context.userId);
}

export async function registrationOptions(context: SecurityRequestContext) {
  const config = getWebAuthnConfig();
  const passkeys = await listActivePasskeys(context);
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: userName(context),
    userID: new TextEncoder().encode(context.userId),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required'
    },
    excludeCredentials: passkeys.map((passkey) => ({
      id: String(passkey.credential_id),
      transports: Array.isArray(passkey.transports) ? passkey.transports : undefined
    }))
  });

  const challenge = await createChallenge(context, 'registration', options.challenge, null, null);
  return { options, challengeId: String(challenge.id), expiresAt: challenge.expires_at };
}

export async function verifyRegistration(
  context: SecurityRequestContext,
  input: { challengeId: string; response: RegistrationResponseJSON }
) {
  const config = getWebAuthnConfig();
  const challenge = await consumeChallenge(context, 'registration', input.challengeId);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: String(challenge.challenge),
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      requireUserVerification: true
    });
  } catch {
    throw new SecurityProtectionError('webauthn_verification_failed', 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new SecurityProtectionError('webauthn_verification_failed', 400);
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const saved = await storeVerifiedPasskey(context, {
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: input.response.response.transports,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp
  });

  return { verified: true, passkey: saved };
}

export async function authenticationOptions(
  context: SecurityRequestContext,
  input: { actionCode: string; deviceId?: string | null }
) {
  const config = getWebAuthnConfig();
  const passkeys = await listActivePasskeys(context);
  if (!passkeys.length) throw new SecurityProtectionError('passkey_not_found', 404);

  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: 'required',
    allowCredentials: passkeys.map((passkey) => ({
      id: String(passkey.credential_id),
      transports: Array.isArray(passkey.transports) ? passkey.transports : undefined
    }))
  });

  const challenge = await createChallenge(
    context,
    'authentication',
    options.challenge,
    input.actionCode,
    input.deviceId || null
  );
  return { options, challengeId: String(challenge.id), expiresAt: challenge.expires_at };
}

export async function verifyAuthentication(
  context: SecurityRequestContext,
  input: { challengeId: string; response: AuthenticationResponseJSON }
) {
  const config = getWebAuthnConfig();
  const challenge = await consumeChallenge(context, 'authentication', input.challengeId);
  const passkey = await getPasskeyByCredentialId(context, input.response.id);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: String(challenge.challenge),
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      requireUserVerification: true,
      credential: {
        id: String(passkey.credential_id),
        publicKey: passkey.credential_public_key_bytes,
        counter: Number(passkey.counter || 0),
        transports: Array.isArray(passkey.transports) ? passkey.transports : undefined
      }
    });
  } catch {
    throw new SecurityProtectionError('webauthn_verification_failed', 400);
  }

  if (!verification.verified) {
    throw new SecurityProtectionError('webauthn_verification_failed', 400);
  }

  await updatePasskeyCounter(context, String(passkey.id), verification.authenticationInfo.newCounter);
  const actionCode = String(challenge.expected_action || '');
  if (!actionCode) throw new SecurityProtectionError('invalid_request', 400);
  const assurance = await grantSecurityStepUp(
    context,
    actionCode,
    String(passkey.id),
    challenge.device_id ? String(challenge.device_id) : null
  );

  return { verified: true, ...assurance };
}
