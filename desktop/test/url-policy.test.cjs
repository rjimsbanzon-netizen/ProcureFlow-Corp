'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { APP_URL, isAppUrl, isExternalUrl } = require('../url-policy.cjs');

test('allows the exact ProcureFlow application and its internal paths', () => {
  for (const url of [APP_URL, APP_URL + '#/employee-profiles', APP_URL + 'settings', APP_URL.replace(/\/$/, '')]) {
    assert.equal(isAppUrl(url), true, url);
  }
});

test('rejects other sites, similarly named paths, and unsafe schemes', () => {
  for (const url of [
    'http://rjimsbanzon-netizen.github.io/Procurement-System/',
    'https://rjimsbanzon-netizen.github.io/Procurement-System-malicious',
    'https://rjimsbanzon-netizen.github.io/other/',
    'https://attacker.github.io/Procurement-System/',
    'https://rjimsbanzon-netizen.github.io.evil.example/Procurement-System/',
    'javascript:alert(1)', 'file:///C:/Windows/system32/', 'data:text/html,bad', '',
  ]) {
    assert.equal(isAppUrl(url), false, url);
  }
});

test('only external HTTPS links can be opened by the operating system', () => {
  assert.equal(isExternalUrl('https://www.google.com/'), true);
  assert.equal(isExternalUrl('https://github.com/rjimsbanzon-netizen/Procurement-System'), true);
  assert.equal(isExternalUrl(APP_URL), false);
  for (const url of ['mailto:test@example.com', 'javascript:alert(1)', 'file:///tmp/secret', 'http://example.org/', 'data:text/html,test']) {
    assert.equal(isExternalUrl(url), false, url);
  }
});
