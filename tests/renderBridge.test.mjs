import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('../node_modules/typescript');
const source = fs.readFileSync(new URL('../src/core/renderBridge.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const store = {ui: {currentTab:'dashboard',trackingRecordId:null}};
const loaded = {exports:{}};
new Function('require','module','exports',code)(name => {
  if(name==='../store/state') return store;
  throw Error('Unexpected import: '+name);
},loaded,loaded.exports);
const bridge = loaded.exports;

test('legacy render and React hook subscribers receive updates', () => {
  let app = 0, hook = 0;
  bridge.registerRenderListener(() => app++);
  const unsubscribe = bridge.subscribeRender(() => hook++);
  const start = bridge.getRenderVersion();
  bridge.renderApp();
  assert.equal(app,1);
  assert.equal(hook,1);
  assert.equal(bridge.getRenderVersion(),start+1);
  unsubscribe();
  bridge.navigateTo('orders');
  assert.equal(store.ui.currentTab,'orders');
  assert.equal(app,2);
  assert.equal(hook,1);
  bridge.registerRenderListener(null);
});
