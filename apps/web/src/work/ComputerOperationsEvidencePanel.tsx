import React from 'react';
import { COMPUTER_OPERATIONS_CONTRACT } from './computerOperations';
import type { ComputerOperationsEvidence } from './computerOperationsEvidence';

export function ComputerOperationsEvidencePanel({ reports, onClear }: {
  reports: ComputerOperationsEvidence[];
  onClear: () => void;
}) {
  const diagnosticUrl = new URL('/work/computer-operations', COMPUTER_OPERATIONS_CONTRACT.production_origin).href;
  return (
    <section className="execution-panel page-stack" aria-labelledby="diagnostic-evidence-title">
      <h2 id="diagnostic-evidence-title">Diagnostic session evidence</h2>
      <p>The last five completed checks remain in memory while this page is open. Download a report to keep it; leaving or reloading clears this history. Reports contain route checks, not account details or runtime credentials.</p>
      {reports.length === 0 ? <p role="status">No completed checks in this session.</p> : (
        <>
          <ol aria-label="Completed diagnostic checks">
            {reports.map((report, index) => (
              <li key={report.observedAt + '-' + index}>
                <p><time dateTime={report.observedAt}>{report.observedAt}</time> — {report.scope}: <strong>{report.outcome}</strong></p>
                <p>{report.nextAction}</p>
                <a className="execution-action"
                  href={'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2))}
                  download={'atlas-browser-diagnostic-' + report.observedAt.replace(/[:.]/g, '-') + '.json'}>
                  Download report {index + 1}
                </a>
              </li>
            ))}
          </ol>
          <button className="execution-action" type="button" onClick={onClear}>Clear session history</button>
        </>
      )}
      <h3>Open this center with Siri</h3>
      <ol>
        <li>On your iPhone, create a shortcut in Apple Shortcuts named “ATLAS diagnóstico”.</li>
        <li>Add the URL <code style={{ overflowWrap: 'anywhere' }}>{diagnosticUrl}</code>, then the Open URLs action.</li>
        <li>Save it and say “Siri, ATLAS diagnóstico”. Unlock or sign in if your device requests it.</li>
      </ol>
      <p>The existing critical browser checks run when this center opens on the production origin. Siri voice execution has not been verified on this device. This shortcut opens the page; it does not give Siri access to private ATLAS data or read the report aloud.</p>
      <div className="work-actions">
        <a className="execution-action" href={diagnosticUrl}>Open diagnostic center</a>
        <a className="execution-action" href="https://support.apple.com/guide/shortcuts/apd07c25bb38/ios" target="_blank" rel="noreferrer">Apple Siri shortcut guide</a>
      </div>
    </section>
  );
}
