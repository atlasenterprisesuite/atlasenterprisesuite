# ATLAS Direct — first-party browser voice (LAN pilot)

**Status:** PR implementation, not a cellular carrier and not yet certified as an E2E deployment.

ATLAS Direct is a free, provider-independent WebRTC DTLS-SRTP audio transport for two nearby ATLAS browsers. It reuses the existing ATLAS Connect/Wireless navigation and browser microphone APIs. It does not consume an additional Supabase Edge Function, private account token, DID/MSISDN, telephone number or telecommunications plan.

## Why this is useful

ATLAS can carry real-time voice between a user's phone and laptop on an authorized local network while the separate ATLAS Wireless mobile-operator launch requirements remain open. It is a real browser peer connection, not a simulated call or a purchased phone service.

## End-to-end manual connection

1. Both devices open `/connect/direct` over HTTPS, ideally on the same Wi-Fi/LAN. This route is handled by the existing ATLAS web application and its surrounding identity requirements.
2. Caller taps **Create call offer**, permits microphone access, copies its connection details.
3. Caller transfers the offer to the second device over a *trusted private channel*. The receiver pastes it, taps **Answer received offer** and copies the answer.
4. Caller pastes the answer and taps **Connect with received answer**. Both devices may need to tap **Enable speaker** because browsers can block autoplay.
5. **End and clear call** closes the peer connection, stops the microphone tracks, and clears signaling text. Page unmount stops tracks as well.

## Security constraints

- Audio only: do not negotiate camera or data channel.
- Browser's WebRTC DTLS-SRTP transport is mandatory; application rejects SDP with no DTLS fingerprint.
- No recording, upload, server storage, background microphone access or phone number provisioning.
- SDP/ICE connection details may expose network information; share privately, never post publicly.
- ICE servers intentionally empty: no third-party STUN/TURN requirement or usage. NAT/VPN/router behavior may prevent connectivity even for devices on the same Wi-Fi. This is not a guarantee of end-to-end operation under all network conditions.
- Microphone accessed only after the user clicks **Create call offer** or **Answer received offer**.
- **No PSTN, SMS, cellular data, eSIM, porting or emergency calls/911.** Always use existing telephone services for emergency calls.

## Validation and release policy

- Unit tests: offers/answers roundtrip, invalid SDP, unsupported media and payload limits.
- Integration tests: user gesture required for mic, offer generation, media tracks released on hangup, malformed remote signaling rejected.
- CI: run `npm run verify:all` on exact commit.
- P0: test two actual devices on the same trusted LAN with live microphones and speaker; verify ICE connected, audio in both directions, microphone revocation and route under ATLAS Identity.
- P0: verify exact published SHA before claiming live.
- No carrier readiness or phone number activation may be inferred from these WebRTC tests.

## Roadmap toward a serving wireless operator

The existing `docs/atlas-wireless/MVNO_CORE.md`, `OWNED_NETWORK_FOUNDATION.md` and `docs/telecom/atlas-carrier-control-plane.md` define the separate managed network track, requiring spectrum or wholesale network access, SIM/eSIM provisioning, licensed/authorized numbering, interconnect, E911, billing, operational support and verified provider evidence. ATLAS Direct is an independent software capability; neither licensing nor carrier service is supplied by WebRTC.
