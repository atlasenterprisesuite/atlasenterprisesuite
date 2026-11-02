import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCheckEvidence} from '../../scripts/security/atlas-web-777-check-evidence.mjs';
const sha='a'.repeat(40);
function fixture(){return {sha,workflowRuns:[{name:'CI',head_sha:sha}],checkRuns:[{name:'gate',head_sha:sha,status:'completed',conclusion:'success'}],requiredChecks:['gate'],branchRules:[{type:'required_status_checks'}]};}
test('even green checks and configured rules require negative enforcement evidence',()=>assert.ok(verifyCheckEvidence(fixture()).blockers.includes('P0_RULESET_NEGATIVE_ENFORCEMENT_UNPROVEN')));
test('missing check fails',()=>{const x=fixture();x.checkRuns=[];assert.ok(verifyCheckEvidence(x).blockers.some(v=>v.includes('P0_REQUIRED_CHECK_NOT_SUCCESS')))});
test('duplicate check fails',()=>{const x=fixture();x.checkRuns.push({...x.checkRuns[0]});assert.ok(verifyCheckEvidence(x).blockers.some(v=>v.includes('P0_REQUIRED_CHECK_NOT_SUCCESS')))});
test('stale check SHA fails',()=>{const x=fixture();x.checkRuns[0].head_sha='b'.repeat(40);assert.ok(verifyCheckEvidence(x).blockers.includes('P0_STALE_CHECK_SHA'))});
test('cancelled check fails',()=>{const x=fixture();x.checkRuns[0].conclusion='cancelled';assert.ok(verifyCheckEvidence(x).blockers.some(v=>v.includes('P0_REQUIRED_CHECK_NOT_SUCCESS')))});
test('missing required rule fails',()=>{const x=fixture();x.branchRules=[];assert.ok(verifyCheckEvidence(x).blockers.includes('P0_ACTIVE_BRANCH_RULES_UNVERIFIED'))});
test('workflow run is not a check run',()=>{const x=fixture();x.checkRuns=undefined;assert.ok(verifyCheckEvidence(x).blockers.includes('P0_CHECK_RUNS_UNAVAILABLE'))});
test('stale workflow SHA fails',()=>{const x=fixture();x.workflowRuns[0].head_sha='b'.repeat(40);assert.ok(verifyCheckEvidence(x).blockers.includes('P0_STALE_WORKFLOW_SHA'))});
