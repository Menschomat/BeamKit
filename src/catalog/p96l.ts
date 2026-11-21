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
      { side: 'front-edge', centerX: -39.4, centerZ: -5.75, width: 10.2, height: 4, radius: 1.6 },
      { side: 'back-edge', centerX: -29, centerZ: -5.75, width: 16, height: 3.8, radius: 1.7 },
      { side: 'left-edge', centerX: -10.5, centerZ: -7, width: 17, height: 4.8, radius: 2 },
      { side: 'left-edge', centerX: 11.8, centerZ: -5.95, width: 16.3, height: 4.3, radius: 2 },
    ],
  },
} as const;
