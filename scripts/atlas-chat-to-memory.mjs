/**
 * ATLAS 777 REVIEW: offline, read-only adapter for authorized ChatGPT exports and SRT transcripts.
 * No network calls, no automatic approval, no implicit organizational publication.
 * This is an intake tool; the existing authenticated atlas-memory API owns persistence.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_CHARS_PER_RECORD = 12000;
const MAX_RECORDS_PER_BATCH = 50;
const RULES = [
  { id: 'bible-os', patterns: ['biblia','jesus','magdalena','evangelio','cristianismo','gospel'] },
  { id: 'tax', patterns: ['irs','impuesto','tributos','form 1040','tax return','1099','w-2'] },
  { id: 'accounting', patterns: ['contabilidad','accounting','bookkeep','accounts payable','accounts receivable','ledger'] },
  { id: 'payroll', patterns: ['nomina','payroll','homebase','timecard','timesheet'] },
  { id: 'finance', patterns: ['finanzas','financial','presupuesto','investment','cash flow','budget'] },
  { id: 'care', patterns: ['caregiver','care plan','cuidados','atencion domiciliaria'] },
  { id: 'health', patterns: ['salud','health','biomed','medical','hospital','clinica'] },
  { id: 'advisory', patterns: ['advisory','consultoria','business launch'] },
  { id: 'crm', patterns: ['crm','hubspot','customer relationship','prospect','clientes'] },
  { id: 'commerce', patterns: ['commerce','checkout','ecommerce','comercio electronico'] },
  { id: 'inventory', patterns: ['inventario','inventory','purchasing','warehouse','procurement'] },
  { id: 'people', patterns: ['recursos humanos','human resources','recruiting','empleados','empleo'] },
  { id: 'learning', patterns: ['aprendizaje','learning','education','ingles','academy'] },
  { id: 'studio', patterns: ['musica','music','videoclip','poster','imagen','creative','studio','fotografia'] },
  { id: 'voice', patterns: ['voice','voz','audio','microfono','subtitulos','teleprompter'] },
  { id: 'telecom', patterns: ['telecom','esim','operador movil','lifeline','carrier','att'] },
  { id: 'connect', patterns: ['connect','wifi','wireguard','whatsapp','mensajeria'] },
  { id: 'device-os', patterns: ['iphone','windows','device os','dispositivos','bluetooth','remote access'] },
  { id: 'gps', patterns: ['gps','mapa','cartografia','geolocalizacion'] },
  { id: 'city', patterns: ['digital city','orlando','ciudad digital'] },
  { id: 'ride', patterns: ['ride','uber','lyft','vehiculo','movilidad'] },
  { id: 'aviation', patterns: ['aviation','aircraft','aeronave','aviacion'] },
  { id: 'hospitality', patterns: ['hotel','restaurante','hospitality'] },
  { id: 'events', patterns: ['concierto','eventos','events','entretenimiento'] },
  { id: 'frontier', patterns: ['galaxy','robotics','robotica','frontier'] },
  { id: 'cloud', patterns: ['cloudflare','supabase','vercel','cloud infrastructure'] },
  { id: 'execution', patterns: ['workflow','github actions','runner','orquestador','pipeline'] },
  { id: 'release-control', patterns: ['deploy','production gate','ci/cd','release','p0 no-go','exact-sha'] },
  { id: 'assistant', patterns: ['chatgpt','gemini','openai api','assistant','inteligencia artificial'] }
];

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function classifyChatKnowledge(title, content) {
  const foldedTitle = fold(title);
  const foldedBody = fold(content);
  const scored = RULES.map((rule, order) => {
    let score = 0;
    for (const word of rule.patterns) {
      if (foldedTitle.includes(word)) score += 5;
      if (foldedBody.includes(word)) score += 1;
    }
    return { id: rule.id, score, order };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.order - b.order);

  // Restrict cross-module noise: retain ties and strong matches, not every passing word.
  const selected = scored.filter((item, i) => i < 5 && (i === 0 || item.score >= 2));
  return {
    module_ids: selected.length ? selected.map(item => item.id) : ['knowledge'],
    classification_basis: selected.length ? 'keyword_suggestion' : 'needs_review'
  };
}

function textForMessage(message) {
  const role = String(message?.author?.role || '');
  if (role !== 'user' && role !== 'assistant') return null;
  const parts = message?.content?.parts;
  let text = '';
  if (Array.isArray(parts)) {
    text = parts.filter(part => typeof part === 'string').join('\n');
  } else if (typeof message?.content?.text === 'string') {
    text = message.content.text;
  }
  return text.trim() ? role.toUpperCase() + ': ' + text : null;
}

function selectedMessages(conversation) {
  const mapping = conversation.mapping && typeof conversation.mapping === 'object' ? conversation.mapping : {};
  const current = conversation.current_node;
  if (typeof current === 'string' && mapping[current]) {
    const nodes = [];
    const visited = new Set();
    let cursor = current;
    while (typeof cursor === 'string' && mapping[cursor] && !visited.has(cursor)) {
      visited.add(cursor);
      nodes.push(mapping[cursor]);
      cursor = mapping[cursor]?.parent;
    }
    return nodes.reverse().map(node => node?.message);
  }
  // Older exports without current_node: a deterministic, timestamp-ordered fallback.
  return Object.values(mapping).map(node => node?.message).filter(Boolean)
    .sort((a, b) => Number(a.create_time || 0) - Number(b.create_time || 0));
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function chunkText(text) {
  const parts = [];
  for (let offset = 0; offset < text.length; offset += MAX_CHARS_PER_RECORD) {
    parts.push(text.slice(offset, offset + MAX_CHARS_PER_RECORD));
  }
  return parts;
}

function recordsForConversation(conversationId, title, text, sourceSystem) {
  if (!conversationId || !text.trim()) return [];
  const chunks = chunkText(text);
  return chunks.map((chunk, index) => {
    const sourceRef = sourceSystem + ':' + conversationId + ':chunk:' + (index + 1);
    const classification = classifyChatKnowledge(title, chunk);
    return {
      kind: 'note',
      title: String(title || 'Imported conversation').slice(0, 200) + ' [' + (index + 1) + '/' + chunks.length + ']',
      summary: 'Unverified conversation excerpt. Classification is provisional; review and redact before approval.',
      content_json: {
        text: chunk,
        conversation_id: conversationId,
        segment_number: index + 1,
        segment_count: chunks.length,
        classification_basis: classification.classification_basis
      },
      source_type: 'chat_import',
      source_ref: sourceRef,
      source_hash: sha256(sourceRef + '\n' + chunk),
      module_ids: classification.module_ids,
      tags: ['chat-import', 'review-required', sourceSystem],
      sensitivity: 'restricted'
    };
  });
}

export function prepareChatGptExport(input) {
  if (!Array.isArray(input)) throw new Error('expected_chatgpt_conversations_array');
  const records = [];
  const skipped = [];
  const seenIds = new Set();
  input.forEach((conversation, index) => {
    if (!conversation || typeof conversation !== 'object' || Array.isArray(conversation)) {
      skipped.push({ index, reason: 'invalid_conversation' });
      return;
    }
    const id = String(conversation.id || conversation.conversation_id || '').trim();
    if (!id || seenIds.has(id)) {
      skipped.push({ index, reason: id ? 'duplicate_conversation_id' : 'missing_conversation_id' });
      return;
    }
    seenIds.add(id);
    const messages = selectedMessages(conversation);
    const text = messages.map(textForMessage).filter(Boolean).join('\n\n');
    if (!text) {
      skipped.push({ index, reason: 'no_text_messages' });
      return;
    }
    records.push(...recordsForConversation(id, conversation.title, text, 'chatgpt-export'));
  });
  return { records, skipped };
}

export function prepareSrtTranscript(sourceName, content) {
  const text = String(content || '').replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('empty_srt');
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const lines = blocks.map(block => block.split('\n')
    .filter(line => !/^\d+$/.test(line.trim()) && !/^\d\d:\d\d:\d\d[,.]\d+\s*-->/.test(line.trim()))
    .join('\n').trim()).filter(Boolean);
  if (!lines.length) throw new Error('no_srt_text');
  const id = sha256(text);
  return {
    records: recordsForConversation(id, sourceName, lines.join('\n\n'), 'srt'),
    skipped: []
  };
}

export function createImportBatches(result) {
  if (!result || !Array.isArray(result.records)) throw new Error('invalid_import_result');
  const batches = [];
  for (let i = 0; i < result.records.length; i += MAX_RECORDS_PER_BATCH) {
    batches.push({ approve: false, records: result.records.slice(i, i + MAX_RECORDS_PER_BATCH) });
  }
  return batches;
}

export function writePrivateImportBatches(result, outDir) {
  if (!outDir) throw new Error('output_directory_required');
  const destination = resolve(outDir);
  const repositoryRoot = resolve(process.cwd());
  if (destination === repositoryRoot || destination.startsWith(repositoryRoot + sep)) {
    throw new Error('refusing_private_export_inside_repository');
  }
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32' && (statSync(destination).mode & 0o077)) {
    throw new Error('output_directory_must_be_private');
  }
  const batches = createImportBatches(result);
  const written = batches.map((batch, index) => {
    const filename = 'atlas-chat-drafts-' + String(index + 1).padStart(4, '0') + '.json';
    const pathname = resolve(destination, filename);
    writeFileSync(pathname, JSON.stringify(batch, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return pathname;
  });
  writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify({
    status: 'local_drafts_not_uploaded',
    record_count: result.records.length,
    batch_count: batches.length,
    skipped: result.skipped,
    approval: 'manual_required'
  }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return written;
}

function option(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = option('--input');
  const directory = option('--out-dir');
  if (!file || !directory) throw new Error('Usage: node scripts/atlas-chat-to-memory.mjs --input conversations.json|chat.srt --out-dir /private/folder');
  const extension = extname(file).toLowerCase();
  const contents = readFileSync(file, 'utf8');
  const result = extension === '.json'
    ? prepareChatGptExport(JSON.parse(contents))
    : extension === '.srt'
      ? prepareSrtTranscript(file.split(/[\\/]/).pop(), contents)
      : (() => { throw new Error('unsupported_input_extension'); })();
  const written = writePrivateImportBatches(result, directory);
  process.stdout.write(JSON.stringify({
    records_prepared: result.records.length,
    batches_prepared: written.length,
    conversations_skipped: result.skipped.length,
    status: 'local_only_unapproved'
  }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(String(error?.message || error) + '\n');
    process.exitCode = 1;
  });
}
