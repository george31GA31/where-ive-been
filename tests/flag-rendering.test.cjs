'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('shared flags retain final CSP-safe markup, escaping and the At Sea icon', () => {
  const context = vm.createContext({
    localStorage: { getItem: () => null },
    document: { addEventListener() {} },
    window: { addEventListener() {}, HVFlagThumbnails: { GB: 'assets/flags-display/GB.webp' } },
  });
  new vm.Script(fs.readFileSync(path.join(__dirname, '../app-core.js'), 'utf8')).runInContext(
    context,
  );
  assert.equal(
    vm.runInContext("flagHtml('gb')", context),
    '<img class="flag-img" src="assets/flags-display/GB.webp" alt="United Kingdom flag" loading="lazy" decoding="async" referrerpolicy="no-referrer">',
  );
  const sea = vm.runInContext("flagHtml('sea')", context);
  assert.match(sea, /special-location-icon.*aria-label="At Sea"/);
  assert.match(sea, /<svg.*stroke-width="1.6"/);
  assert.equal(vm.runInContext('flagHtml(null)', context), '');
  assert.match(
    vm.runInContext('flagHtml("GB", \'flag-img" onclick="bad\')', context),
    /class="flag-img&quot; onclick=&quot;bad"/,
  );
  assert.doesNotMatch(vm.runInContext("flagHtml('GB')", context), /onerror=|onclick=/);
});

test('failed flag images still fail closed through the captured error listener', () => {
  let listener;
  class Image {
    constructor() {
      this.classList = { contains: (name) => name === 'flag-img' };
      this.style = {};
    }
  }
  const context = vm.createContext({
    document: {
      addEventListener(type, callback, capture) {
        assert.equal(type, 'error');
        assert.equal(capture, true);
        listener = callback;
      },
    },
    HTMLImageElement: Image,
  });
  new vm.Script(
    fs.readFileSync(path.join(__dirname, '../security-runtime.js'), 'utf8'),
  ).runInContext(context);
  const image = new Image();
  listener({ target: image });
  assert.equal(image.style.display, 'none');
  listener({ target: {} });
});
