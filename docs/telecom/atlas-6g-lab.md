# ATLAS 6G Lab — simulation milestone

Tracking #835. Research only. No 6G certification, radio transmission, allocated spectrum, live carrier, or deployed coverage is implied.

The TypeScript free-space model uses the Friis approximation (32.44 + 20 log10 MHz + 20 log10 km) to estimate received power and SNR. The link selector chooses the viable candidate with the largest modeled SNR margin. The model ignores obstructions, multipath, mobility, interference, protocol overhead, antenna pattern, and device thermal constraints; it is **not** a real-world coverage predictor.

Run `npx vitest run tests/unit/atlas-6g-lab.test.ts` from repository root after installing dependencies.

Future work: seeded fading/channel models, interference and scheduler simulations, IMT-2030 evaluation mapping, authorized receive-only SDR, hardware E2E tests, and FreeWave integration. All physical RF transmission requires regulatory review and authorized equipment. Carrier PSTN truth gates remain unchanged.
