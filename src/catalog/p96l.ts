export const p96l = {
  id: 'smallrig.p96l',
  revision: 1,
  label: 'SmallRig P96L',
  body: { width: 110, height: 60, depth: 11.5, radius: 6 },
  aperture: { width: 105, height: 55, radius: 3.5 },
  // Schematic markers communicate access locations without reproducing hardware.
  detail: {
    rearSeamFromBack: 2.5,
    markers: [
      { side: 'front-edge', centerX: -34, centerZ: -5.75, width: 9, height: 3.4, radius: 1.6 },
      { side: 'back-edge', centerX: -29, centerZ: -5.75, width: 16, height: 3.8, radius: 1.7 },
    ],
  },
} as const;
