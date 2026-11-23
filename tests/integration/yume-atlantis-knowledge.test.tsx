// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import {
  YUME_ATLANTIS_GRAPH,
  YUME_SOURCE_REVIEW,
  validateYumeGraph
} from '../../apps/web/src/modules/knowledge/research/yumeAtlantisGraph';
import { YumeAtlantisKnowledgePage } from '../../apps/web/src/modules/knowledge/research/YumeAtlantisKnowledgePage';

afterEach(cleanup);

describe('ATLAS Knowledge — YUME / Atlantis 777', () => {
  it('preserves 50 source nodes, 61 typed edges and 16 traceable references', () => {
    expect(YUME_ATLANTIS_GRAPH.nodes).toHaveLength(50);
    expect(YUME_ATLANTIS_GRAPH.edges).toHaveLength(61);
    expect(Object.keys(YUME_ATLANTIS_GRAPH.sources)).toHaveLength(16);
    expect(validateYumeGraph(YUME_ATLANTIS_GRAPH)).toEqual([]);
    expect(new Set(YUME_ATLANTIS_GRAPH.nodes.map(node => node.id)).size).toBe(50);
    expect(YUME_ATLANTIS_GRAPH.edges.filter(edge => edge.type === 'pendiente')).toHaveLength(3);
  });

  it('fails closed on orphan relations, duplicate nodes and missing source references', () => {
    const broken = {
      ...YUME_ATLANTIS_GRAPH,
      nodes: [...YUME_ATLANTIS_GRAPH.nodes, YUME_ATLANTIS_GRAPH.nodes[0]],
      edges: [...YUME_ATLANTIS_GRAPH.edges, {
        source: 'missing',
        target: 'yume',
        type: 'pendiente' as const,
        reason: 'test only',
        source_ids: ['S999']
      }]
    };
    expect(validateYumeGraph(broken).join(' ')).toContain('duplicate_or_empty_node');
    expect(validateYumeGraph(broken).join(' ')).toContain('orphan_edge');
    expect(validateYumeGraph(broken).join(' ')).toContain('missing_edge_source');
  });

  it('keeps unreviewed or placeholder references visible but not actionable', () => {
    expect(YUME_SOURCE_REVIEW.S08).toBe('needs_review');
    expect(YUME_SOURCE_REVIEW.S12).toBe('needs_review');
    expect(YUME_SOURCE_REVIEW.S14).toBe('needs_review');
    render(<YumeAtlantisKnowledgePage />);
    expect(screen.getByRole('heading', { name: /YUME, Atlántida/ })).toBeTruthy();
    expect(screen.getByText(/no equivale a conocimiento organizacional aprobado/i)).toBeTruthy();
  });

  it('supports accessible concept searching and graph traversal', () => {
    render(<YumeAtlantisKnowledgePage />);
    const search = screen.getByRole('searchbox', { name: 'Buscar conceptos' });
    fireEvent.change(search, { target: { value: 'Platón' } });
    fireEvent.click(screen.getByRole('button', { name: 'Platón' }));
    expect(screen.getByRole('heading', { name: 'Platón' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explorar Timeo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Explorar Timeo' }));
    expect(screen.getByRole('heading', { name: 'Timeo' })).toBeTruthy();
  });

  it('registers only a protected route and no alternate persistence API', () => {
    const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
    const entry = readFileSync('apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx', 'utf8');
    const page = readFileSync('apps/web/src/modules/knowledge/research/YumeAtlantisKnowledgePage.tsx', 'utf8');
    expect(resolver).toContain("pathname === '/knowledge/research/yume-atlantis'");
    expect(resolver).toContain('<RequireAtlasIdentity><YumeAtlantisKnowledgePage /></RequireAtlasIdentity>');
    expect(entry).toContain('href="/knowledge/research/yume-atlantis"');
    expect(page).not.toContain('createAtlasMemoryDraft');
    expect(page).not.toContain('localStorage');
    expect(page).not.toContain('supabase.from');
  });
});
