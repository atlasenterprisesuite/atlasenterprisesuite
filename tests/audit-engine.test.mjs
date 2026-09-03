import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDocument, providerDependentFindings } from '../src/modules/site-review/audit-engine.js';

function findingByRule(findings, ruleId) {
  return findings.find((finding) => finding.ruleId === ruleId);
}

test('detects deterministic SEO, accessibility and security issues from markup', () => {
  const markup = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title></title></head><body><h1>One</h1><h1>Two</h1><img src="hero.jpg"><a href="">Empty</a></body></html>`;
  const findings = auditDocument(markup, 'http://example.com');

  assert.equal(findingByRule(findings, 'security.https').status, 'detected');
  assert.equal(findingByRule(findings, 'seo.title').status, 'detected');
  assert.equal(findingByRule(findings, 'seo.meta_description').status, 'detected');
  assert.equal(findingByRule(findings, 'seo.canonical').status, 'detected');
  assert.equal(findingByRule(findings, 'content.h1_count').status, 'detected');
  assert.equal(findingByRule(findings, 'accessibility.image_alt').status, 'detected');
  assert.equal(findingByRule(findings, 'content.empty_links').status, 'detected');
  assert.equal(findingByRule(findings, 'content.viewport').status, 'passed');
});

test('reports passing findings when markup contains required signals', () => {
  const markup = `<!doctype html><html><head><title>ATLAS</title><meta name="description" content="Enterprise"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"><meta property="og:title" content="ATLAS"><meta property="og:description" content="Enterprise"></head><body><h1>ATLAS</h1><img src="hero.jpg" alt="ATLAS dashboard"><a href="/about">About</a></body></html>`;
  const findings = auditDocument(markup, 'https://example.com');

  assert.equal(findingByRule(findings, 'security.https').status, 'passed');
  assert.equal(findingByRule(findings, 'seo.title').status, 'passed');
  assert.equal(findingByRule(findings, 'seo.meta_description').status, 'passed');
  assert.equal(findingByRule(findings, 'seo.canonical').status, 'passed');
  assert.equal(findingByRule(findings, 'content.h1_count').status, 'passed');
  assert.equal(findingByRule(findings, 'accessibility.image_alt').status, 'passed');
});

test('provider-dependent checks are truthful not_configured findings', () => {
  const findings = providerDependentFindings();
  assert.ok(findings.length >= 3);
  assert.ok(findings.every((finding) => finding.status === 'not_configured'));
  assert.ok(findings.some((finding) => finding.ruleId === 'performance.core_web_vitals'));
  assert.ok(findings.some((finding) => finding.ruleId === 'seo.search_console_indexing'));
});
