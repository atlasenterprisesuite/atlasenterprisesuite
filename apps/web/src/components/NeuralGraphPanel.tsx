import { useMemo, useState } from 'react';
import type { GraphEdge, GraphNode } from '../../../../packages/health/types';

export function NeuralGraphPanel({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [selected, setSelected] = useState<string | null>(nodes[0]?.id ?? null);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selected) ?? null, [nodes, selected]);

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
            className={`graph-node ${selected === node.id ? 'selected' : ''}`}
            onClick={() => setSelected(node.id)}
            role="listitem"
          >
            <small>{node.type.replaceAll('_', ' ')}</small>
            <strong>{node.label}</strong>
            <span>{Math.round(node.confidence * 100)}% confidence</span>
          </button>
        ))}
        <div className="edge-list" aria-label="Graph relationships">
          {edges.map((edge) => <span key={edge.id}>{edge.sourceNodeId} → {edge.relationType} → {edge.targetNodeId}</span>)}
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
              <div><dt>Evidence refs</dt><dd>{selectedNode.evidenceRecordIds.length}</dd></div>
              <div><dt>Diseases</dt><dd>{selectedNode.diseaseIds.join(', ')}</dd></div>
            </dl>
          </>
        )}
      </aside>
    </div>
  );
}
