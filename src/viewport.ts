import {
  AmbientLight, Box3, BufferAttribute, BufferGeometry, Color, DirectionalLight,
  GridHelper, Group, LineBasicMaterial, LineLoop, LineSegments, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { p96l } from './catalog/p96l.ts';
import { roundedOutline } from './geometry/profile.ts';
import type { GridMesh } from './geometry/protocol.ts';

export function createViewport(host: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.append(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color('#E7E7E7');
  const camera = new PerspectiveCamera(36, 1, 1, 1500);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxDistance = 500;
  controls.minDistance = 30;

  const floor = new GridHelper(300, 30, '#bdbdc1', '#d2d2d4');
  floor.rotation.x = Math.PI / 2;
  floor.position.z = -14;
  scene.add(floor, new AmbientLight(0xffffff, 1.8));
  const light = new DirectionalLight(0xffffff, 2.8);
  light.position.set(-40, -50, 100);
  scene.add(light);

  const lamp = new Group();
  const lines = new LineBasicMaterial({ color: '#64646c' });
  const body = roundedOutline(p96l.body);
  for (const [outline, z] of [
    [body, 0], [body, -11.5], [body, -9], [roundedOutline(p96l.aperture), 0],
  ] as const) {
    lamp.add(new LineLoop(new BufferGeometry().setFromPoints(
      outline.map(([x, y]) => new Vector3(x, y, z)),
    ), lines));
  }
  const uprights = body.filter((_, index) => index % 9 === 0).flatMap(([x, y]) => [
    new Vector3(x, y, 0), new Vector3(x, y, -11.5),
  ]);
  lamp.add(new LineSegments(new BufferGeometry().setFromPoints(uprights), lines));
  scene.add(lamp);

  const grid = new Mesh(new BufferGeometry(), new MeshStandardMaterial({
    color: '#3d3d43', roughness: 0.78,
  }));
  scene.add(grid);

  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(() => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(host);

  function fit() {
    const bounds = new Box3();
    if (lamp.visible) bounds.expandByObject(lamp);
    if (grid.geometry.index) bounds.expandByObject(grid);
    const center = new Vector3();
    bounds.getCenter(center);
    const extent = bounds.getSize(new Vector3()).length() || 125;
    const distance = extent / (2 * Math.tan(18 * Math.PI / 180) * Math.min(camera.aspect, 1));
    camera.position.copy(center).addScaledVector(new Vector3(0.7, -1, 0.85).normalize(), distance);
    controls.target.copy(center);
    controls.update();
    render();
  }
  fit();

  return {
    fit,
    update(mesh: GridMesh | null, mode: 'assembly' | 'exploded' | 'grid') {
      lamp.visible = mode !== 'grid';
      grid.position.z = mode === 'exploded' ? 19 : 0.5;
      grid.geometry.dispose();
      grid.geometry = new BufferGeometry();
      if (mesh) {
        grid.geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
        grid.geometry.setIndex(new BufferAttribute(mesh.indices, 1));
        grid.geometry.computeVertexNormals();
      }
      render();
    },
    dispose() {
      resize.disconnect();
      controls.dispose();
      lamp.children.forEach((line) => (line as LineLoop).geometry.dispose());
      lines.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
