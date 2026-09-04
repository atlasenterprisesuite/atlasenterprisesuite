import type { EvidenceRecord, GraphEdge, GraphNode } from '../../../../packages/health/types';

interface NeuralGraphPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceRecord[];
}

export function NeuralGraphPanel({ nodes, edges, evidence }: NeuralGraphPanelProps) {
  const evidenceById = new Map(evidence.map((record) => [record.id, record]));

  if (nodes.length === 0) {
    return <div className="empty-state"><strong>No graph nodes</strong><span>No governed demo nodes match this view.</span></div>;
  }

  return (
    <section className="graph-panel" aria-label="Neural Graph">
      <div className="graph-node-list">
        {nodes.map((node) => (
          <article className="graph-node" key={node.id}>
            <div className="card-heading">
              <span className="status-chip neutral">{node.type.replaceAll('_', ' ')}</span>
              <span>{Math.round(node.confidence * 100)}% demo confidence</span>
            </div>
            <h3>{node.label}</h3>
            <p>{node.description}</p>
            <small>
              Evidence: {node.evidenceRecordIds.map((id) => evidenceById.get(id)?.sourceIdentifier ?? id).join(', ') || 'none registered'}
            </small>
          </article>
        ))}
      </div>
      <div className="graph-edge-list" aria-label="Graph relationships">
        {edges.map((edge) => (
          <div key={edge.id} className="graph-edge">
            <span>{edge.sourceNodeId}</span>
            <strong>{edge.relationType.replaceAll('_', ' ')}</strong>
            <span>{edge.targetNodeId}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
