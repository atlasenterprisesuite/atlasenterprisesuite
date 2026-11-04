import { useState } from 'react';
import { buildLocalMediaManifest } from '../../../../../../packages/core/src/localMediaManifest';

export function LocalMediaPicker() {
  const [summary, setSummary] = useState('No files selected.');
  return <section aria-label="Local media selection">
    <h2>Select local media</h2>
    <p>Files remain on your device. No upload or iCloud synchronization occurs.</p>
    <label>Choose files<input type="file" multiple onChange={event => {
      const result = buildLocalMediaManifest(Array.from(event.currentTarget.files || []));
      setSummary(`${result.accepted.length} accepted, ${result.rejected.length} rejected. Local only.`);
      event.currentTarget.value = '';
    }} /></label>
    <p role="status">{summary}</p>
  </section>;
}
