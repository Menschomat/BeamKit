import {
  AmbientLight, Box3, BufferAttribute, BufferGeometry, Color, DirectionalLight,
  ExtrudeGeometry, GridHelper, Group, LineBasicMaterial, LineLoop, LineSegments, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Path, PerspectiveCamera, Scene, Shape, ShapeGeometry,
  Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { lamps } from './catalog/registry.ts';
import { lampReferenceLines } from './geometry/lamp-reference.ts';
import { materialRegions } from './domain/materials.ts';
import type { AssemblyResult } from './generators/assembly.ts';
import type { createPanelLighting } from './viewport-lighting.ts';
export type PreviewPose = 'assembly' | 'print';

export function createViewport(host: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.append(renderer.domElement);
  const scene = new Scene();
  const background = new Color(getComputedStyle(host).getPropertyValue('--color-canvas').trim());
  scene.background = background;
  const camera = new PerspectiveCamera(34, 1, 0.1, 2000); camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement); controls.maxDistance = 600; controls.minDistance = 35;
  const floor = new GridHelper(350, 35, '#d5d5d5', '#f4f4f4'); floor.rotation.x = Math.PI / 2; floor.position.z = -16;
  scene.add(floor, new AmbientLight(0xffffff, 1.55));
  const light = new DirectionalLight(0xffffff, 1.85); light.position.set(-40, -90, 180); scene.add(light);
  const rim = new DirectionalLight(0xffffff, 0.6); rim.position.set(60, 40, 30); scene.add(rim);
  const lamp = new Group();
  const profile = lamps[0];
  const reference = lampReferenceLines(profile);
  const lines = new LineBasicMaterial({ transparent: true, opacity: 0.65, depthWrite: false });
  const apertureLine = new LineBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
  const housingTint = new MeshBasicMaterial({ transparent: true, opacity: 0.21, depthWrite: false });
  const litAperture = new MeshBasicMaterial({ color: new Color('#fff2db').multiplyScalar(2.6), toneMapped: false });
  const housingDepth = new MeshBasicMaterial({
    transparent: true, colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

  // Use the procedural reference contours for the translucent viewport surfaces.
  const [front, , rearSeam, aperture, ...markers] = reference.loops;
  const housing = new ExtrudeGeometry(new Shape(front.map(([x, y]) => new Vector2(x, y))), {
    depth: profile.body.depth, bevelEnabled: false,
  });
  housing.translate(0, 0, -profile.body.depth);
  // Write the visible housing depth before drawing the tinted surfaces and outlines.
  // This keeps back-side lines from showing through the controls.
  const housingMask = new Mesh(housing, housingDepth);
  housingMask.renderOrder = -1;
  lamp.add(housingMask);
  const housingMesh = new Mesh(housing, housingTint);
  lamp.add(housingMesh);
  const apertureMesh = new Mesh(new ShapeGeometry(new Shape(aperture.map(([x, y]) => new Vector2(x, y)))), litAperture);
  apertureMesh.position.z = 0.01;
  apertureMesh.renderOrder = 1;
  lamp.add(apertureMesh);
  const bay = profile.detail.leftControlBay;
  const bayPlane = bay ? -profile.body.width / 2 + bay.insetMm : undefined;
  const seamSegments = rearSeam.flatMap((point, i) => {
    const next = rearSeam[(i + 1) % rearSeam.length];
    return point[0] === bayPlane && next[0] === bayPlane ? [] : [point, next];
  });
  const seam = new LineSegments(new BufferGeometry().setFromPoints(seamSegments.map(p => new Vector3(...p))), lines);
  seam.renderOrder = 2;
  lamp.add(seam);
  function addOutline(points: Vector3[], material: LineBasicMaterial) {
    const outline = new LineLoop(new BufferGeometry().setFromPoints(points), material);
    outline.renderOrder = 2;
    lamp.add(outline);
  }
  for (const [i, loop] of [front, reference.loops[1], aperture, ...markers].entries()) {
    // Project the measured opening outlines onto the visible bay wall instead of drawing
    // them behind the simplified housing surface.
    const markerPlane = bayPlane !== undefined && i >= 3 && profile.detail.markers[i - 3].side === 'left-edge'
      ? bayPlane - 0.01 : undefined;
    addOutline(loop.map(([x, y, z]) => new Vector3(markerPlane ?? x, y, z)),
      loop === aperture ? apertureLine : lines);
  }
  if (reference.mountingSeat) {
    const { outline, opening } = reference.mountingSeat;
    const toFace = ([x, , z]: [number, number, number]) => new Vector2(x, z);
    const shape = new Shape(outline.map(toFace));
    shape.holes.push(new Path(opening.map(toFace)));
    const seat = new Mesh(new ShapeGeometry(shape), housingTint);
    seat.rotation.x = Math.PI / 2;
    seat.position.y = outline[0][1];
    seat.renderOrder = 1;
    lamp.add(seat);
    addOutline(outline.map(point => new Vector3(...point)), lines);
    addOutline(opening.map(point => new Vector3(...point)), apertureLine);
  }
  const uprights = new LineSegments(new BufferGeometry().setFromPoints(reference.segments.map(p => new Vector3(...p))), lines);
  uprights.renderOrder = 2;
  lamp.add(uprights);
  scene.add(lamp);
  const partGroup = new Group(); scene.add(partGroup);
  const material = new MeshStandardMaterial({ color: '#6c8494', roughness: 0.8, metalness: 0.01, flatShading: true });
  const regionMaterials = {
    honeycomb: new MeshStandardMaterial({ color: materialRegions.honeycomb.color, roughness: 0.8, flatShading: true }),
    liner: new MeshStandardMaterial({ color: materialRegions.liner.color, roughness: 0.8, flatShading: true }),
    shell: new MeshStandardMaterial({ color: materialRegions.shell.color, roughness: 0.8, flatShading: true }),
  };
  const printMaterials = [material, ...Object.values(regionMaterials)];
  let displayed: AssemblyResult | null = null;
  let displayedTheme: 'light' | 'dark' | undefined;
  let disposed = false;
  let cameraInteracted = false;
  let lightingRequested = false;
  let lighting: ReturnType<typeof createPanelLighting> | undefined;
  const render = () => {
    if (lamp.visible && lighting) lighting.render();
    else renderer.render(scene, camera);
  };
  controls.addEventListener('change', render);
  controls.addEventListener('start', () => { cameraInteracted = true; });
  function resizeViewport() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height); lighting?.resize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  const resize = new ResizeObserver(resizeViewport);
  resize.observe(host);
  function fit() {
    const bounds = new Box3(); if (lamp.visible) bounds.expandByObject(lamp);
    if (partGroup.children.length) bounds.expandByObject(partGroup);
    if (bounds.isEmpty()) bounds.setFromCenterAndSize(new Vector3(), new Vector3(115, 65, 25));
    const center = bounds.getCenter(new Vector3());
    const direction = new Vector3(0.38, -0.72, 1.25).normalize();
    const right = new Vector3().crossVectors(camera.up, direction).normalize();
    const screenUp = new Vector3().crossVectors(direction, right).normalize();
    const tangent = Math.tan(17 * Math.PI / 180);
    let distance = 30;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new Vector3(x, y, z).sub(center);
      const towardCamera = point.dot(direction);
      distance = Math.max(distance, Math.abs(point.dot(screenUp)) / tangent + towardCamera,
        Math.abs(point.dot(right)) / (tangent * Math.max(camera.aspect, 0.1)) + towardCamera);
    }
    camera.position.copy(center).addScaledVector(direction, distance * 1.12);
    controls.target.copy(center); controls.update(); render();
  }
  function clearParts() { for (const mesh of partGroup.children) (mesh as Mesh).geometry.dispose(); partGroup.clear(); }
  resizeViewport();
  fit();
  return {
    update(result: AssemblyResult | null, pose: PreviewPose, theme: 'light' | 'dark') {
      if (theme !== displayedTheme) {
        displayedTheme = theme;
        const style = getComputedStyle(host);
        const color = (property: string) => style.getPropertyValue(property).trim();
        background.set(color('--color-canvas'));
        floor.material.color.set(color('--preview-grid'));
        lines.color.set(color('--preview-outline'));
        housingTint.color.set(color('--preview-housing'));
        apertureLine.color.set(color('--preview-highlight'));
      }
      const printPose = pose === 'print';
      const showLamp = !printPose;
      const poseChanged = lamp.visible !== showLamp;
      lamp.visible = showLamp;
      if (lamp.visible && !lightingRequested) {
        lightingRequested = true;
        void import('./viewport-lighting.ts').then(({ createPanelLighting }) => {
          if (disposed) return;
          lighting = createPanelLighting(renderer, scene, camera, profile.aperture);
          render();
        }).catch(() => { /* The bright diffuser still renders if the lighting module is unavailable. */ });
      }
      partGroup.rotation.x = printPose ? Math.PI : 0;
      partGroup.position.z = printPose && result?.parts.length ? Math.max(...result.parts.map(part => part.bounds.max[2])) : 0;
      floor.position.z = printPose ? -0.05 : -16;
      const firstGeometry = displayed === null && result !== null;
      if (displayed !== result) {
        clearParts(); displayed = result;
        for (const [index, part] of (result?.regions ?? result?.parts ?? []).entries()) {
          const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(part.mesh.positions, 3));
          geometry.setIndex(new BufferAttribute(part.mesh.indices, 1)); geometry.computeVertexNormals();
          const region = result?.regions?.[index];
          const mesh = new Mesh(geometry, region ? regionMaterials[region.material] : material);
          mesh.position.set(...part.transform);
          partGroup.add(mesh);
        }
      }
      if (poseChanged || (firstGeometry && !cameraInteracted)) fit();
      else render();
    },
    dispose() {
      disposed = true;
      lighting?.dispose();
      resize.disconnect(); controls.dispose(); clearParts(); printMaterials.forEach(printMaterial => printMaterial.dispose());
      const referenceGeometries = new Set(lamp.children.map(object => (object as Mesh | LineLoop | LineSegments).geometry));
      referenceGeometries.forEach(geometry => geometry.dispose());
      for (const material of [lines, apertureLine, housingTint, litAperture, housingDepth]) material.dispose();
      floor.geometry.dispose(); floor.material.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
