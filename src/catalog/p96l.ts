export const p96l = {
  id: 'smallrig.p96l',
  revision: 1,
  label: 'SmallRig P96L',
  body: { width: 110, height: 60, depth: 11.5, radius: 6 },
  aperture: { width: 105, height: 55, radius: 3.5 },
  detail: {
    rearSeamFromBack: 2.5,
    leftControlBay: { insetMm: 0.8, flatHalfSpanMm: 20.65, outerHalfSpanMm: 22.25 },
    mountingSeat: {
      centerX: 0, faceY: -30.5, openingCenterZ: -5.75, openingRadiusMm: 3.175,
      halfWidthMm: 8.68, endHalfWidthMm: 6.84, cornerRiseMm: 0.75,
    },
    markers: [
      { side: 'front-edge', centerAlongEdge: -39.4, centerZ: -6.25, width: 10.2, height: 4, radius: 1.6 },
      { side: 'back-edge', centerAlongEdge: -32.3, centerZ: -5.75, width: 5.5, height: 3.5, radius: 1.65, outwardOffset: 1.2 },
      { side: 'back-edge', centerAlongEdge: -22.6, centerZ: -5.75, width: 3.85, height: 3.85, radius: 1.85, outwardOffset: 0.2 },
      // Left-edge markers use Y along the edge. Surrounds sit behind the housing silhouette.
      { side: 'left-edge', centerAlongEdge: -10.475, centerZ: -7, width: 18.15, height: 4.8, radius: 2.35, outwardOffset: -0.8 },
      { side: 'left-edge', centerAlongEdge: 11.8, centerZ: -5.95, width: 16.3, height: 4.3, radius: 2.1, outwardOffset: -0.8 },
      { side: 'left-edge', centerAlongEdge: -10.475, centerZ: -7, width: 16.15, height: 2.8, radius: 1.39, outwardOffset: -1.8 },
      { side: 'left-edge', centerAlongEdge: 11.8, centerZ: -5.95, width: 14.3, height: 2.3, radius: 1.14, outwardOffset: -1.8 },
    ],
  },
} as const;
