import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../../prototypes/domains-web-studio/index.html',import.meta.url),'utf8');
test('pilot includes mobile viewport and responsive grid',()=>{assert.match(html,/name="viewport"/);assert.match(html,/@media\(max-width:750px\)/);});
test('pilot uses accessible input and live result',()=>{assert.match(html,/<label for="domain">/);assert.match(html,/id="domain"/);assert.match(html,/role="status" aria-live="polite"/);});
test('pilot explicitly discloses no live domain availability or purchasing',()=>{assert.match(html,/No consulta disponibilidad ni realiza compras/);assert.match(html,/Disponibilidad no comprobada/);});
test('pilot does not include checkout, live DNS mutations or external scripts',()=>{assert.doesNotMatch(html,/<script[^>]+src=/);assert.doesNotMatch(html,/fetch\(|XMLHttpRequest|stripe\.redirectToCheckout|dns\.records\.create/i);});
