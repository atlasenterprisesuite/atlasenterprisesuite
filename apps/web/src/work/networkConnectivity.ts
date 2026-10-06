export type NetworkSymptom = 'streaming' | 'uploads' | 'voice' | 'certificates' | 'ios';
export const NETWORK_GUIDANCE = [
  { id: 'streaming', label: 'Responses stall or disconnect', requirements: ['Permit secure WebSocket upgrades over TCP 443 to ws.chatgpt.com and chatgpt.com.', 'Review proxy idle timeouts and frame-size limits; TLS inspection must not rewrite or close the handshake.'] },
  { id: 'uploads', label: 'Files or images fail to upload', requirements: ['Allow *.oaiusercontent.com in the network, VPN and URL filter.', 'A browser CORS error alone does not prove that the destination is blocked.'] },
  { id: 'voice', label: 'Voice interrupts or has poor quality', requirements: ['Permit UDP 3478 to the current ranges published at https://openai.com/chatgpt-voice.json; TCP 443 is the fallback.', 'Refresh the official ranges when they change. A browser route probe cannot verify UDP reachability.'] },
  { id: 'certificates', label: 'TLS or certificate errors', requirements: ['Review TLS inspection for public OpenAI domains with the network administrator.', 'Use scoped policy exceptions where appropriate; preserve certificate validation and access controls.'] },
  { id: 'ios', label: 'Unusual activity in the iPhone app', requirements: ['Update ChatGPT, sign out and back in, and test without a VPN.', 'Compare the same action on Wi-Fi and cellular. If it fails only on Wi-Fi, investigate that network.', 'If persistent, follow the official guide for DNS and Apple App Attest diagnostics.'] }
].map((item) => ({ ...item, evidence: 'guidance-only' as const }));
export function networkGuidanceFor(symptom: NetworkSymptom) {
  return NETWORK_GUIDANCE.find((item) => item.id === symptom)!;
}
