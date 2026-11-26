import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contextDataMessage} from '../../supabase/functions/atlas-copilot/context-envelope.mjs';
test('data-only envelope preserves content as a string',()=>{const text='Reference notes: "hello"\nSecond line';const message=contextDataMessage(text);assert.equal(message.role,'user');assert.deepEqual(JSON.parse(message.content),{kind:'atlas_context_data',authority:'none',text});});
test('empty or non-string context is omitted',()=>{for(const value of [null,undefined,0,{},'', '  '])assert.equal(contextDataMessage(value),null);});
test('context length is bounded',()=>{assert.equal(JSON.parse(contextDataMessage('a'.repeat(13000)).content).text.length,12000);});
