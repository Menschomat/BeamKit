import { RectAreaLight, Vector2 } from 'three';
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Aperture } from './geometry/profile.ts';

export function createPanelLighting(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, aperture: Aperture) {
  RectAreaLightUniformsLib.init();
  const light = new RectAreaLight('#fff4df', 2.5, aperture.width, aperture.height);
  light.position.z = 0.02;
  light.lookAt(0, 0, 1);
  light.visible = false;
  scene.add(light);

  // Bloom needs a render target that can preserve brightness above display white.
  const composer = renderer.extensions.has('EXT_color_buffer_float') ? new EffectComposer(renderer) : null;
  const bloom = composer ? new UnrealBloomPass(renderer.getSize(new Vector2()), 0.25, 0.45, 1) : null;
  const output = composer ? new OutputPass() : null;
  if (composer && bloom && output) {
    composer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.5));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(output);
  }

  return {
    render() {
      light.visible = true;
      try {
        if (composer) composer.render();
        else renderer.render(scene, camera);
      } finally {
        light.visible = false;
      }
    },
    resize(width: number, height: number) {
      composer?.setSize(width, height);
    },
    dispose() {
      scene.remove(light);
      bloom?.dispose();
      output?.dispose();
      composer?.dispose();
    },
  };
}
