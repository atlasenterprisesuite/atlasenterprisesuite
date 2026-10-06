import React, { useState } from 'react';
import { NETWORK_GUIDANCE, networkGuidanceFor, type NetworkSymptom } from './networkConnectivity';

export function NetworkConnectivityPanel() {
  const [symptom, setSymptom] = useState<NetworkSymptom>('streaming');
  const guidance = networkGuidanceFor(symptom);
  return (
    <section className="execution-panel page-stack" aria-labelledby="network-connectivity-title">
      <h2 id="network-connectivity-title">Network connectivity troubleshooting</h2>
      <p>Choose the failing action to see the relevant network requirements. These are OpenAI service requirements, not proof that an ATLAS provider is connected.</p>
      <label htmlFor="network-symptom">Observed symptom</label>
      <select id="network-symptom" value={symptom} onChange={(event) => setSymptom(event.target.value as NetworkSymptom)}>
        {NETWORK_GUIDANCE.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <div role="status" aria-live="polite">
        <ul>{guidance.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
      </div>
      <p>Run the critical route checks above for ATLAS HTTP evidence. DNS, firewall, WebSocket and UDP causes require their own measurements; a failed HTTP request alone cannot identify them.</p>
      <div className="work-actions">
        <a className="execution-action" href="https://status.openai.com/" target="_blank" rel="noreferrer">OpenAI service status</a>
        <a className="execution-action" href="https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps" target="_blank" rel="noreferrer">Official network guide</a>
      </div>
    </section>
  );
}
