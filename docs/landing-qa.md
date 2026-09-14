# Landing implementation and verification

Public page: `/`. Preserved officer UI: `/officer.html`.

## File inventory

Created:

- `dashboard/landing.css`, `dashboard/landing.js`, `dashboard/workflow.css`
- `dashboard/officer.html`
- `dashboard/botanical.svg`, `dashboard/field-map.svg`
- `dashboard/vendor/three/three.module.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`, `LICENSE`, `README.md`
- `backend/app/routes/diagnosis.py`
- `tests/test_landing.py`, `tests/browser-harness.html`
- `docs/landing-qa.md`

Modified from the audited working tree:

- `dashboard/index.html`, `dashboard/app.js`, `dashboard/hero-3d.js`
- `dashboard/style.css` (trailing whitespace only)
- `backend/app/main.py` (register same-origin diagnosis adapter)
- `ml/serving/app.py` (read treatment JSON as UTF-8 on Windows)
- `README.md`

Existing uncommitted work was preserved. No database records were added to the
installation by this verification. Existing tracked bytecode changes were left
as found. The prepared GLB was not edited.

## Verified

- Ran the FastAPI backend and existing trained ML service.
- Root landing page, officer route, existing health/auth/read APIs, static assets.
- GLB HTTP 200; one copy at `dashboard/models/TomatoPlant_Final.glb` (9,412,716 bytes).
- Runtime targets: TomatoPlant, DiseasedLeaf, Soil; color, normal, roughness and
  metalness textures present. Inspected hero and upper-front leaf close-up.
- Desktop nine-stage sequence: life/settle, disease focus, capture, analysis,
  example diagnosis, report, single geo signal, hotspot, officer intelligence.
- Mobile six-stage sequence: plant, disease focus, capture/analysis, example
  diagnosis, report, regional signal/officer handoff.
- Browser viewport checks: 360×800, 390×844, 412×915, 1366×768, 1440×900,
  1920×1080. No horizontal overflow; primary CTA visible on phone viewports.
- Visual refinement of plant lighting, mobile annotation, report-to-cluster
  animation, farmer form text and final page composition.
- Actual file chooser → image preview → same-origin prediction → model result.
- Keyboard focus trap, Escape close and focus restoration.
- Simulated reduced-motion preference, unavailable WebGL and failed model download.
- Isolated browser fixtures: offline diagnosis, unsupported image, report success,
  denied location and server rejection. Failed reports remained retryable; no
  synthetic success or diagnosis was substituted for a failure.
- Seven automated tests pass; report round-trip uses an in-memory database.
- JavaScript syntax checks and `git diff --check` pass.
- Working OpenStreetMap tiles and report markers in the preserved Leaflet map.
- No console errors on the final normal landing/officer runs.
- Temporary generation files, duplicate source staging files and served QA page removed.

## Remaining limits

- Existing model reliability is not validated. It accepted a flat-color synthetic
  image with high confidence during integration testing. This is an existing
  classifier/OOD limitation, not a landing-page prediction claim.
- The original model is 9.4 MB / 210,579 rendered triangles. Rendering is capped
  at about 30 FPS, DPR 1.25 on phones and 1.5 on desktop, with no postprocessing
  or shadow maps. Physical Android hardware and mobile-network performance were
  not measured; tests used desktop browser viewport overrides.
- Phone camera/location access needs HTTPS outside localhost. The officer map
  and its existing external libraries need network access.
