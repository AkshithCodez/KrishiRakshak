/**
 * KrishiRakshak — Story Timeline
 * Pure, reversible scroll-to-narrative mapping.
 * No DOM side effects. No globals.
 */

export const clamp  = n => Math.max(0, Math.min(1, n));
// Smoothstep: maps [a,b] range to eased [0,1]
export const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * narrativeProgress — remaps raw scroll [0,1] to narrative [0,1].
 * Desktop: identity (no remapping needed).
 * Mobile:  compresses the 9-beat story into a shorter scroll so the
 *          story resolves before the bottom of the sticky section.
 */
export function narrativeProgress(q, mobile = false) {
  q = clamp(q);
  if (!mobile) return q;
  // Mobile: compress the key beats to fit 340svh instead of 770svh
  const stops = [
    [0,    0   ],
    [0.12, 0.08],   // soil visible
    [0.30, 0.30],   // growth complete
    [0.44, 0.48],   // disease focus
    [0.65, 0.70],   // capture+scan merged
    [0.80, 0.78],   // diagnosis
    [1.00, 1.00],   // hotspot
  ];
  for (let i = 1; i < stops.length; i++) {
    const [x, y] = stops[i], [a, b] = stops[i - 1];
    if (q <= x) return b + (y - b) * (q - a) / (x - a);
  }
  return 1;
}

/**
 * stageAt — returns a semantic stage name for the current narrative progress.
 * Used to set data-stage on the specimen element for CSS-driven overlays.
 * Keep in sync with hero-3d.js camera key p values.
 */
export function stageAt(p, mobile = false) {
  if (p <  0.08) return 'soil';
  if (p <  0.25) return 'growth';
  if (p <  0.35) return 'life';
  if (p <  0.48) return 'focus';
  if (p <  0.60 || (mobile && p < 0.70)) return 'capture';
  if (p <  0.70) return 'analysis';
  if (p <  0.78) return 'diagnosis';
  if (p <  0.87) return 'report';
  return 'hotspot';
}
