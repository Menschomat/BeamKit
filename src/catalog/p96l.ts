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
      { side: 'front-edge', centerAlongEdge: -39.4, centerZ: -6.25, width: 10.2, height: 4, radius: 1.6 },
      { side: 'back-edge', centerAlongEdge: -32.3, centerZ: -5.75, width: 5.5, height: 3.5, radius: 1.65, outwardOffset: 1.2 },
      { side: 'back-edge', centerAlongEdge: -22.6, centerZ: -5.75, width: 3.85, height: 3.85, radius: 1.85, outwardOffset: 0.2 },
      // Left-edge markers use Y along the edge. Surrounds sit behind the housing silhouette.
      { side: 'left-edge', centerAlongEdge: -10.475, centerZ: -7, width: 18.15, height: 4.8, radius: 2.35, outwardOffset: -0.8 },
      { side: 'left-edge', centerAlongEdge: 11.8, centerZ: -5.95, width: 16.3, height: 4.3, radius: 2.1, outwardOffset: -0.8 },
      { side: 'left-edge', centerAlongEdge: -10.475, centerZ: -7, width: 12.27, height: 2, radius: 0.95, outwardOffset: 0.4 },
      { side: 'left-edge', centerAlongEdge: 11.8, centerZ: -5.95, width: 13.78, height: 1.7, radius: 0.8, outwardOffset: -0.48 },
    ],
  },
} as const;
