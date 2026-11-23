import { describe, expect, it } from 'vitest';
import { buildRestrictedMusicDraft, indexChatGptMusicHistory, mergeMusicChatIndexes } from '../../packages/creator/audio/chat_history';

const message = (id: string, role: string, text: unknown) => ({
  id, message: { id, author: { role }, content: { content_type: 'text', parts: [text] }, create_time: 1700000000 }
});

describe('ATLAS Music Universe — privacy-first ChatGPT music export index', () => {
  const exportSample = [
    { id: 'chat-music-1', title: 'Análisis de Alan Walker', create_time: 1700000000, mapping: {
      a: message('a', 'user', 'Investiga Faded y la simbología de sus videos musicales.'),
      b: message('b', 'assistant', 'Análisis de la narrativa audiovisual sin letras protegidas.'),
      c: message('c', 'tool', 'PRIVATE_TOOL_TOKEN=not_for_index')
    } },
    { id: 'chat-music-2', title: 'Composición original', mapping: {
      a: message('a', 'user', 'Crear un motivo original en Am y exportar MIDI para la canción.')
    } },
    { id: 'chat-offtopic', title: 'Cuentas y pagos', mapping: {
      a: message('a', 'user', 'Revisar la conciliación bancaria.')
    } }
  ];

  it('indexes music conversations without retaining verbatim messages, tool data or full transcripts', () => {
    const result = indexChatGptMusicHistory(exportSample);
    expect(result.totalConversations).toBe(3);
    expect(result.musicConversations).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(result.musicConversations[0]).toMatchObject({
      sourceId: 'chat-music-1', title: 'Análisis de Alan Walker', matchedMessages: 1
    });
    expect(result.musicConversations[0].topics).toContain('symbolism');
    expect(result.musicConversations[1].topics).toContain('composition');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_TOOL_TOKEN');
    expect(JSON.stringify(result)).not.toContain('Investiga Faded');
    expect(JSON.stringify(result)).not.toContain('Crear un motivo');
  });

  it('supports a canonical conversations object, excludes synthetic records without source IDs and deduplicates', () => {
    const parsed = indexChatGptMusicHistory({ conversations: [
      exportSample[0],
      exportSample[0],
      { title: 'Música sin ID', mapping: {} }
    ] });
    expect(parsed.musicConversations).toHaveLength(1);
    expect(parsed.totalConversations).toBe(3);
  });

  it('does not index unrelated chat solely because a tool or system message mentions music', () => {
    const data = [{ id: 'offtopic', title: 'Cuentas', mapping: {
      a: message('a','user','Revisar el presupuesto.'),
      b: message('b','system','music music music')
    } }];
    expect(indexChatGptMusicHistory(data).musicConversations).toHaveLength(0);
  });

  it('builds a restricted, unapproved, metadata-only Knowledge Atlas chat-import draft', () => {
    const record = indexChatGptMusicHistory(exportSample).musicConversations[0];
    const draft = buildRestrictedMusicDraft(record);
    expect(draft).toMatchObject({
      kind: 'note', sourceType: 'chat_import', sourceRef: 'chatgpt:chat-music-1',
      sensitivity: 'restricted', moduleIds: ['studio', 'knowledge']
    });
    expect(draft.tags).toContain('music');
    expect(draft.content).not.toContain('Investiga');
    expect(draft.content).toMatch(/not the full transcript/i);
  });

  it('merges numbered export JSONs without duplicate conversation records or lost topics', () => {
    const first = indexChatGptMusicHistory([exportSample[0]]);
    const second = indexChatGptMusicHistory([
      { id: 'chat-music-1', title: 'Alan Walker Music', mapping: { a: message('a', 'user', 'Learn lyrics for a song in English.') } },
      exportSample[1]
    ]);
    const merged = mergeMusicChatIndexes([first, second]);
    expect(merged.totalConversations).toBe(3);
    expect(merged.musicConversations).toHaveLength(2);
    expect(merged.musicConversations[0].topics).toContain('learning');
    expect(merged.musicConversations[0].topics).toContain('symbolism');
    expect(merged.musicConversations[0].matchedMessages).toBe(1);
  });

  it('fails closed for unsupported export shapes', () => {
    expect(() => indexChatGptMusicHistory({ account: { email: 'sensitive@example.com' } })).toThrow(/unsupported_chatgpt_export/i);
    expect(() => indexChatGptMusicHistory(null)).toThrow(/unsupported_chatgpt_export/i);
  });
});
