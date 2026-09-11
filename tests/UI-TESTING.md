# UI integration checks

The application has no production npm dependencies. A separate jsdom environment is used for DOM checks:

```sh
npm install --prefix /tmp/herald-qa jsdom@26.1.0 d3@7.9.0
NODE_PATH=/tmp/herald-qa/node_modules node tests/ui-smoke.cjs
node --test tests/*.test.cjs
python tests/test_country_import.py
```

Override `HV_D3_MODULE` if the temporary installation has a different path. Tests stub network/authentication and use fictional guest data. They exercise actual rendered controls, detached routes, transport CRUD, local persistence, home status, imported facts, manual/slider dates, D3 routes and country clicks. They do not claim browser layout or live account validation.
