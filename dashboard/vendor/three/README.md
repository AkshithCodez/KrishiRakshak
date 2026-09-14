# Three.js 0.160.0

Local copies of the version previously used by this project. This avoids a CDN
dependency on the public landing page and fixes the loader's bare `three` import.

Sources: `https://unpkg.com/three@0.160.0/`:

- `build/three.module.js`
- `examples/jsm/loaders/GLTFLoader.js`
- `examples/jsm/utils/BufferGeometryUtils.js`
- `LICENSE` (MIT)

Only change: the BufferGeometryUtils import in GLTFLoader points to its adjacent
local file. The page import map resolves `three` to `three.module.js`.
