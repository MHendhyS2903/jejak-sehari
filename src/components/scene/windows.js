import { nightU } from './sky.js'

export const windowPatch = (mat) => {
  const m = mat.clone()
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightU
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vJsPos;\nvarying vec3 vJsNrm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 jsP = vec4(transformed, 1.0);
        vec3 jsN = objectNormal;
        #ifdef USE_INSTANCING
          jsP = instanceMatrix * jsP;
          jsN = mat3(instanceMatrix) * jsN;
        #endif
        jsP = modelMatrix * jsP;
        vJsPos = jsP.xyz;
        vJsNrm = normalize(mat3(modelMatrix) * jsN);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vJsPos;
        varying vec3 vJsNrm;
        float jsHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float wall = step(abs(vJsNrm.y), 0.4);
          float along = abs(vJsNrm.x) > abs(vJsNrm.z) ? vJsPos.z : vJsPos.x;
          vec2 g = vec2(along / 0.5, (vJsPos.y - 0.1) / 0.4);
          vec2 id = floor(g);
          vec2 f = fract(g);
          float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.75);
          float on = step(0.42, jsHash(id + floor(vJsPos.xz * 0.5) * 13.0 + sign(vJsNrm.xz) * 5.0));
          float lit = wall * win * on * step(0.45, vJsPos.y) * uNight;
          totalEmissiveRadiance += vec3(1.0, 0.72, 0.36) * 2.2 * lit;
        }`,
      )
  }
  m.customProgramCacheKey = () => 'js-windows'
  return m
}

