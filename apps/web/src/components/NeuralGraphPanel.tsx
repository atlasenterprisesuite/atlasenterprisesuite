import { useMemo, useState } from 'react';
import type { EvidenceRecord, GraphEdge, GraphNode } from '../../../../packages/health/types';

interface NeuralGraphPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceRecord[];
}

type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;

function readableRelation(value: string) {
  return value.replaceAll('_', ' ');
}

export function NeuralGraphPanel({ nodes, edges, evidence }: NeuralGraphPanelProps) {
  const [selected, setSelected] = useState<Selection>(nodes[0] ? { kind: 'node', id: nodes[0].id } : null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const evidenceById = useMemo(() => new Map(evidence.map((record) => [record.id, record])), [evidence]);

  const selectedNode = selected?.kind === 'node' ? nodeById.get(selected.id) ?? null : null;
  const selectedEdge = selected?.kind === 'edge' ? edges.find((edge) => edge.id === selected.id) ?? null : null;
  const selectedEvidenceIds = selectedNode?.evidenceRecordIds ?? selectedEdge?.evidenceRecordIds ?? [];
  const selectedEvidence = selectedEvidenceIds.flatMap((id) => {
    const record = evidenceById.get(id);
    return record ? [record] : [];
  });

  if (nodes.length === 0) {
    return <div className="empty-state"><strong>No graph data</strong><span>Add governed evidence before creating graph relationships.</span></div>;
  }

  return (
    <div className="graph-layout">
      <div className="graph-canvas" role="list" aria-label="Neural Graph nodes">
        {nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className={`graph-node ${selected?.kind === 'node' && selected.id === node.id ? 'selected' : ''}`}
            onClick={() => setSelected({ kind: 'node', id: node.id })}
            role="listitem"
          >
            <small>{node.type.replaceAll('_', ' ')}</small>
            <strong>{node.label}</strong>
            <span>{Math.round(node.confidence * 100)}% confidence</span>
          </button>
        ))}
        <div className="edge-list" aria-label="Graph relationships">
          {edges.length === 0 ? <span>No relationships match the current filters.</span> : edges.map((edge) => {
            const source = nodeById.get(edge.sourceNodeId)?.label ?? edge.sourceNodeId;
            const target = nodeById.get(edge.targetNodeId)?.label ?? edge.targetNodeId;
            const relation = readableRelation(edge.relationType);
            return (
              <button
                type="button"
                key={edge.id}
                className={`edge-button ${selected?.kind === 'edge' && selected.id === edge.id ? 'selected' : ''}`}
                aria-label={`${source} ${relation} ${target}`}
                onClick={() => setSelected({ kind: 'edge', id: edge.id })}
              >
                {source} → {relation} → {target}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="inspector" aria-live="polite">
        {selectedNode && (
          <>
            <p className="eyebrow">Selected node</p>
            <h3>{selectedNode.label}</h3>
            <p>{selectedNode.description}</p>
            <dl>
              <div><dt>Status</dt><dd>{selectedNode.status}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(selectedNode.confidence * 100)}%</dd></div>
              <div><dt>Diseases</dt><dd>{selectedNode.diseaseIds.join(', ')}</dd></div>
            </dl>
          </>
        )}
        {selectedEdge && (
          <>
            <p className="eyebrow">Selected relationship</p>
            <h3>{readableRelation(selectedEdge.relationType)}</h3>
            <p>{nodeById.get(selectedEdge.sourceNodeId)?.label ?? selectedEdge.sourceNodeId} → {nodeById.get(selectedEdge.targetNodeId)?.label ?? selectedEdge.targetNodeId}</p>
            <dl>
              <div><dt>Status</dt><dd>{selectedEdge.status}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(selectedEdge.confidence * 100)}%</dd></div>
              <div><dt>Direction</dt><dd>{selectedEdge.direction}</dd></div>
            </dl>
            <div className="inspector-section">
              <strong>Falsification notes</strong>
              {selectedEdge.falsificationNotes.length === 0
                ? <p>No falsification notes registered.</p>
                : <ul>{selectedEdge.falsificationNotes.map((note) => <li key={note}>{note}</li>)}</ul>}
            </div>
          </>
        )}
        <div className="inspector-section">
          <strong>Supporting evidence</strong>
          {selectedEvidence.length === 0
            ? <p>No supporting evidence registered for this selection.</p>
            : <ul>{selectedEvidence.map((record) => <li key={record.id}><span>{record.title}</span><small>{record.evidenceLevel.replaceAll('_', ' ')} · {record.status}</small></li>)}</ul>}
        </div>
        <div className="inspector-section">
          <strong>Contradictory evidence</strong>
          <p>No contradictory evidence record is registered for this demo selection. Absence of a record is not evidence of absence.</p>
        </div>
      </aside>
    </div>
  );
}
