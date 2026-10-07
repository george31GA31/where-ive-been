/* Compare two real static releases using identical records, clocks and services. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const binary = require('@sparticuz/chromium');
binary.setGraphicsMode = false;

const root = path.resolve(process.env.HV_CANDIDATE_ROOT || path.join(__dirname, '..'));
const baselineRoot = process.env.HV_BASELINE_ROOT;
if (!baselineRoot)
  throw new Error('Set HV_BASELINE_ROOT to a checkout of the release being preserved.');
const out = path.join(root, 'test-results/visual-parity');
fs.mkdirSync(out, { recursive: true });

// A populated history exercises counts, split dates, hotels, stored routes and tools.
const fixture = {
  version: 2,
  activeProfileId: 'a',
  profiles: [
    {
      id: 'a',
      name: 'Alex',
      citizenships: ['GB'],
      homeCountryCodes: ['GB'],
      enabledRules: ['schengen'],
    },
  ],
  trips: [{ id: 'alps', profileId: 'a', name: 'Eastern Alps 2026', notes: 'Keep this itinerary' }],
  stays: [
    {
      id: 'slovenia',
      profileId: 'a',
      tripId: 'alps',
      countryCode: 'SI',
      countryName: 'Slovenia',
      start: '2026-09-10',
      end: '2026-09-13',
      status: 'actual',
    },
    {
      id: 'austria',
      profileId: 'a',
      tripId: 'alps',
      countryCode: 'AT',
      countryName: 'Austria',
      start: '2026-09-14',
      end: '2026-09-22',
      status: 'actual',
    },
    {
      id: 'future',
      profileId: 'a',
      countryCode: 'FR',
      countryName: 'France',
      start: '2026-12-01',
      end: '2026-12-04',
      status: 'planned',
    },
    {
      id: 'sea',
      profileId: 'a',
      countryCode: 'SEA',
      countryName: 'At Sea',
      start: '2026-09-23',
      end: '2026-09-24',
      status: 'actual',
    },
  ],
  transports: [
    {
      id: 'flight',
      profileId: 'a',
      tripId: 'alps',
      type: 'flight',
      status: 'actual',
      startLocal: '2026-09-10T10:00',
      endLocal: '2026-09-10T12:00',
      start: { name: 'London', iata: 'LHR', lat: 51.47, lon: -0.45 },
      end: { name: 'Ljubljana', iata: 'LJU', lat: 46.22, lon: 14.46 },
      price: { amount: 89, currency: 'GBP' },
    },
  ],
  accommodations: [
    {
      id: 'hotel-one',
      profileId: 'a',
      tripId: 'alps',
      propertyName: 'Hotel One',
      place: { name: 'Hotel One', lat: 46.05, lon: 14.5, countryCode: 'SI' },
      location: 'Ljubljana',
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
      notes: 'Keep hotel notes',
    },
    {
      id: 'hotel-two',
      profileId: 'a',
      tripId: 'alps',
      propertyName: 'Hotel Two',
      location: 'Innsbruck',
      checkIn: '2026-09-14',
      checkOut: '2026-09-18',
    },
  ],
  residences: [],
  placeVisits: [],
  savedPlaces: [],
  excludedCountryCodes: [],
  manualCountryVisits: [
    { id: 'manual', profileId: 'a', countryCode: 'DZ', visited: true, year: 2025 },
  ],
  tccVisits: [],
  notes: [
    {
      id: 'note',
      profileId: 'a',
      tripId: 'alps',
      title: 'Travel notes',
      body: 'Keep original notes',
      category: 'General',
    },
  ],
  checklists: [],
  budgets: [],
  expenses: [],
  roadTrips: [],
  currencyRates: [],
  currencyPreferences: [],
  visualLayers: { calendar: { countries: true, transport: true, accommodation: true } },
};

function serve(directory) {
  const base = path.resolve(directory);
  return http.createServer((req, res) => {
    let file = path.resolve(
      base,
      '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
    );
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!path.extname(file)) file = path.join(file, 'index.html');
    try {
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.webp': 'image/webp',
        }[path.extname(file)] || 'application/octet-stream',
      );
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
}

const servers = [serve(baselineRoot), serve(root)];
const results = [];
let browser;

async function settled(page) {
  await page.waitForFunction(() => window.HVPages && document.querySelector('main > .view.active'));
  await page.evaluate(() => document.fonts.ready);
  // Full-page captures include off-screen lazy flags. Decode the same complete
  // artwork on both sides rather than comparing viewport-dependent placeholders.
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map(async (image) => {
        image.loading = 'eager';
        try {
          await image.decode();
        } catch {
          /* The existing image-error handler owns failed flags. */
        }
      }),
    ),
  );
  await page.waitForTimeout(250);
}

async function capture(pair, label, prepare) {
  const images = [],
    states = [],
    roundedElements = [];
  for (let i = 0; i < pair.length; i++) {
    const page = pair[i].page;
    await prepare(page, pair[i].origin);
    await settled(page);
    if (label.startsWith('map-')) await page.waitForSelector('.map-country');
    roundedElements.push(
      await page.evaluate(() =>
        [...document.querySelectorAll('input,select,textarea,button,dialog[open]')]
          .map((input) => {
            const rect = input.getBoundingClientRect(),
              style = getComputedStyle(input);
            return {
              type: input.type,
              x: rect.x,
              y: rect.y + scrollY,
              width: rect.width,
              height: rect.height,
              color: style.color,
              background: style.backgroundColor,
              border: style.border,
              borderRadius: style.borderRadius,
              boxShadow: style.boxShadow,
              font: style.font,
            };
          })
          .filter((rect) => rect.width && rect.height),
      ),
    );
    const filename = path.join(out, `${label}-${i === 0 ? 'before' : 'after'}.png`);
    images.push(
      await page.screenshot({
        path: filename,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      }),
    );
    states.push(
      await page.evaluate(() => ({
        state: JSON.parse(JSON.stringify(state)),
        storage: Object.fromEntries(
          ['whereIveBeen.data.v2', 'whereIveBeen.guest.v1', 'whereIveBeen.stays.v1'].map((key) => [
            key,
            localStorage.getItem(key),
          ]),
        ),
      })),
    );
  }
  assert.deepEqual(states[1], states[0], `State/storage changed in ${label}`);
  assert.deepEqual(
    roundedElements[1],
    roundedElements[0],
    `Control/dialog geometry or style changed in ${label}`,
  );
  const identical = images[0].equals(images[1]);
  let changedPixels = 0,
    maxDelta = 0,
    onlyNativeRounding = true;
  if (!identical) {
    const before = PNG.sync.read(images[0]),
      after = PNG.sync.read(images[1]);
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    for (let offset = 0; offset < before.data.length; offset += 4) {
      let delta = 0;
      for (let channel = 0; channel < 4; channel++)
        delta = Math.max(
          delta,
          Math.abs(before.data[offset + channel] - after.data[offset + channel]),
        );
      if (!delta) continue;
      changedPixels++;
      maxDelta = Math.max(maxDelta, delta);
      const x = (offset / 4) % before.width,
        y = Math.floor(offset / 4 / before.width);
      if (
        !roundedElements[0].some((rect) => {
          const radius = Math.max(
            ...rect.borderRadius.split(' ').map(parseFloat).filter(Number.isFinite),
          );
          return (
            radius > 0 &&
            x >= Math.floor(rect.x) &&
            x < Math.ceil(rect.x + rect.width) &&
            y >= Math.floor(rect.y) &&
            y < Math.ceil(rect.y + rect.height) &&
            (x < rect.x + radius + 1 || x >= rect.x + rect.width - radius - 1) &&
            (y < rect.y + radius + 1 || y >= rect.y + rect.height - radius - 1)
          );
        })
      )
        onlyNativeRounding = false;
    }
  }
  // Baseline-vs-baseline captures expose tiny raster differences at rounded
  // control/dialog corners. Permit at most 64 such pixels, with identical
  // computed styles/bounds; every other pixel must match. No screen is masked.
  const passed = identical || (onlyNativeRounding && changedPixels <= 64 && maxDelta <= 3);
  results.push({
    scene: label,
    identical,
    changedPixels,
    maxDelta,
    nativeRounding: !identical && passed,
    passed,
  });
  if (!passed) console.error('Visual difference: ' + label);
}

(async () => {
  for (const server of servers)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origins = servers.map((server) => 'http://127.0.0.1:' + server.address().port);
  browser = await chromium.launch({
    executablePath: process.env.HV_CHROMIUM_PATH || (await binary.executablePath()),
    args: binary.args.filter((arg) => arg !== '--single-process'),
    headless: true,
  });

  for (const width of [390, 768, 1440])
    for (const theme of ['light', 'dark']) {
      const pair = [];
      for (const origin of origins) {
        const context = await browser.newContext({
          viewport: { width, height: 960 },
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        // Hold Date constant while leaving timers/animation frames free to settle.
        // Route persistence timestamps must not depend on machine speed.
        await page.clock.setFixedTime(new Date('2026-09-21T12:00:00Z'));
        await page.route('**/*', (route) => {
          const url = route.request().url();
          if (url.startsWith(origin)) return route.continue();
          if (url.includes('/d3@'))
            return route.fulfill({
              path: path.join(root, 'node_modules/d3/dist/d3.min.js'),
              contentType: 'text/javascript',
            });
          if (url.includes('/topojson-client@'))
            return route.fulfill({
              path: path.join(root, 'node_modules/topojson-client/dist/topojson-client.min.js'),
              contentType: 'text/javascript',
            });
          if (url.includes('/world-atlas@'))
            return route.fulfill({
              path: path.join(root, 'node_modules/world-atlas/countries-50m.json'),
              contentType: 'application/json',
            });
          return route.abort();
        });
        await page.addInitScript(
          ({ fixture, theme }) => {
            localStorage.setItem('whereIveBeen.data.v2', JSON.stringify(fixture));
            localStorage.setItem('whereIveBeen.theme.v1', theme);
          },
          { fixture, theme },
        );
        pair.push({ page, context, origin, errors });
      }
      const suffix = width + '-' + theme;
      for (const route of [
        'dashboard',
        'trips',
        'calendar',
        'journey-map',
        'map',
        'countries',
        'stats',
        'travel-tools',
        'travel-tools/stay-planner',
        'travel-tools/entry-requirements',
        'travel-tools/notes',
        'travel-tools/budget',
        'travel-tools/currency',
        'travel-tools/road-trip',
        'people',
      ]) {
        await capture(pair, route.replaceAll('/', '-') + '-' + suffix, (page, origin) =>
          page.goto(origin + '/#/' + route),
        );
      }
      const forms = [
        [
          'trip-planner',
          () => HVCalendar.openTripPlanner({ start: '2026-10-05', end: '2026-10-12' }),
        ],
        ['edit-country', () => openStayDialog('austria')],
        ['edit-flight', () => HVJourneys.openTransport('flight')],
        ['edit-accommodation', () => HVCalendar.openAccommodationDialog('alps', 'hotel-one')],
        ['journey-popup', () => HVJourneyMap.open('trip:alps')],
      ];
      for (const [name, open] of forms) {
        await capture(pair, name + '-' + suffix, async (page, origin) => {
          await page.goto(origin + '/#/calendar');
          await settled(page);
          await page.evaluate(open);
          await page.waitForSelector('dialog[open]');
          if (name === 'journey-popup') {
            await page.waitForSelector('.marker-accommodation');
            await page.locator('.marker-accommodation').first().click();
            await page.waitForSelector('.leaflet-popup');
          }
        });
      }
      for (const item of pair) {
        assert.deepEqual(item.errors, [], 'Uncaught browser errors');
        await item.context.close();
      }
      console.log('Compared populated pages/forms: ' + suffix);
    }
  fs.writeFileSync(path.join(out, 'comparison.json'), JSON.stringify(results, null, 2));
  assert.ok(
    results.every((result) => result.passed),
    'Inspect the before/after PNGs in test-results/visual-parity',
  );
  console.log(
    `Visual parity passed: ${results.length} screenshot pairs; ${results.filter((result) => result.identical).length} byte-identical, remaining differences limited to measured rounded-corner rasterization. Travel/storage snapshots and control/dialog layout/styles are unchanged.`,
  );
})()
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.writeFileSync(path.join(out, 'comparison.json'), JSON.stringify(results, null, 2));
    if (browser) await browser.close();
    for (const server of servers) server.close();
  });
