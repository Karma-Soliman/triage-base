// Exercise route handlers with a deterministic provider; no paid LLM calls.
const ts = require('typescript');
const Module = require('node:module');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const original = Module._load;
const saved = [];
let calls = 0;
let mode = 'valid';
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
Module._load = function(id, parent, main) {
  if (id.endsWith('/llm')) return { model: 'test-model', llm: { chat: { completions: { create: async () => {
    calls++;
    if (mode === 'fail') throw new Error('provider down');
    return { model: 'test-model', usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, choices: [{ message: { content: mode === 'invalid' ? '{"category":"unknown"}' : JSON.stringify({ category: 'account', priority: 'low', needs_human_review: false, explanation: 'Test prediction' }) } }] };
  } } } } };
  if (id.endsWith('/runs')) return { saveRun: async run => saved.push(run) };
  return original.apply(this, arguments);
};
process.env.LLM_INPUT_USD_PER_MILLION = '1';
process.env.LLM_OUTPUT_USD_PER_MILLION = '2';
const triage = require('../app/api/triage/route.ts');
const smoke = require('../app/api/smoke/route.ts');
const request = data => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(data) });
(async () => {
  assert.equal((await triage.POST(request({ subject: '', body: ' ' }))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await triage.POST(new Request('http://localhost/api', { method: 'POST', body: '{' }))).status, 400);
  const result = await (await triage.POST(request({ subject: '', body: 'Help' }))).json();
  assert.deepEqual(result.usage, { input: 10, output: 5, total: 15 });
  assert.equal(result.costUsd, 0.00002);
  mode = 'invalid';
  assert.equal((await triage.POST(request({ subject: '', body: 'Help' }))).status, 502);
  assert.equal((await smoke.POST(request({ dataset: 'labelled100', sampleSize: 101 }))).status, 400);
  mode = 'valid';
  const run = await (await smoke.POST(request({ dataset: 'labelled100', sampleSize: 6 }))).json();
  assert.equal(new Set(run.tickets.map(t => t.ticketId)).size, 6);
  assert.equal(run.categoryMismatches, run.tickets.filter(t => t.expected.category !== 'account').length);
  assert.equal(run.priorityMismatches, run.tickets.filter(t => t.expected.priority !== 'low').length);
  assert.equal(run.categoryAccuracy, (6 - run.categoryMismatches) / 6);
  assert.equal(run.usage.total, 90);
  mode = 'fail';
  const failed = await (await smoke.POST(request({ dataset: 'labelled100', sampleSize: 2 }))).json();
  assert.equal(failed.failed, 2); assert.equal(failed.categoryAccuracy, null); assert.equal(failed.costUsd, null);
  mode = 'valid';
  const unlabelled = await (await smoke.POST(request({ dataset: 'tickets500', sampleSize: 2 }))).json();
  assert.equal(unlabelled.categoryMismatches, null);
  assert.equal(unlabelled.tickets[0].expected, null);
  assert.equal(saved.length, 3);
  // Verify real persistence in an isolated temporary working directory.
  Module._load = original;
  const os = require('node:os'); const path = require('node:path');
  const previous = process.cwd(); const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-test-'));
  try {
    process.chdir(temp);
    const logs = require('../lib/runs.ts');
    assert.deepEqual(await logs.readRuns(), []);
    await logs.saveRun(run); await logs.saveRun(failed);
    assert.deepEqual((await logs.readRuns()).map(r => r.id), [failed.id, run.id]);
  } finally { process.chdir(previous); fs.rmSync(temp, { recursive: true }); }
  console.log('Passed: validation, usage, sampling, mismatches, failures, unlabelled results and persistence.');
})().catch(error => { console.error(error); process.exitCode = 1; });
