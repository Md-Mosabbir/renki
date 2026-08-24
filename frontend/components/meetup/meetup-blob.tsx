'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The meetup blob.
 *
 * A displaced icosphere driven by 3D simplex noise in the vertex shader, lit
 * only by a fresnel rim in the fragment shader. Nothing about it is a texture
 * or a video — the shape is recomputed every frame from `uTime`, which is why
 * it can react instantly to a state change instead of playing a clip.
 *
 * ── What this is NOT ──────────────────────────────────────────────────────
 * The blob is not itself the scannable code, and cannot be. A QR symbol
 * decodes from three sharp finder squares and hard-edged modules; an organic
 * surface that moves has neither, and no camera would ever read it. So the
 * blob is the shell and the code sits crisp at its centre (see `MeetupCodePlate`).
 * The blob is what reacts — arming, confirming, failing — and that reaction is
 * the part worth building in 3D.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type BlobPhase = 'idle' | 'arming' | 'verified' | 'failed';

interface PhaseLook {
  amplitude: number;
  frequency: number;
  speed: number;
  glow: number;
  core: THREE.Color;
  rim: THREE.Color;
}

/**
 * Where each phase is heading. The blob never jumps to these — every frame it
 * eases toward whichever set is current, so a phase change is a transformation
 * rather than a cut. That easing is the whole reason the verified state reads
 * as an event.
 */
const LOOKS: Record<BlobPhase, PhaseLook> = {
  // Breathing. Present, not demanding attention.
  idle: {
    amplitude: 0.15,
    frequency: 1.3,
    speed: 0.5,
    glow: 0.75,
    core: new THREE.Color('#5b1e06'),
    rim: new THREE.Color('#ff8a3d'),
  },
  // A code is live and counting down. Faster, hotter, visibly impatient.
  arming: {
    amplitude: 0.27,
    frequency: 1.85,
    speed: 1.5,
    glow: 1.5,
    core: new THREE.Color('#7c2d12'),
    rim: new THREE.Color('#ffb066'),
  },
  // Confirmed. The noise falls away and the churning surface resolves into a
  // calm sphere — the visual claim being made is "this is settled now".
  verified: {
    amplitude: 0.035,
    frequency: 1.0,
    speed: 0.35,
    glow: 1.25,
    core: new THREE.Color('#04372a'),
    rim: new THREE.Color('#34d399'),
  },
  failed: {
    amplitude: 0.32,
    frequency: 2.6,
    speed: 2.2,
    glow: 0.9,
    core: new THREE.Color('#450a0a'),
    rim: new THREE.Color('#f87171'),
  },
};

/* Ashima Arts' 3D simplex noise (MIT), inlined because a shader cannot import.
   Chosen over value noise because it has no grid-aligned artefacts — the
   directional streaks those produce are exactly what makes a blob read as a
   cheap effect rather than a surface. */
const SIMPLEX_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uBurst;

varying float vDisplacement;
varying vec3 vNormalV;
varying vec3 vViewDir;

${SIMPLEX_GLSL}

void main() {
  // Two octaves at different speeds. One alone reads as a single wobbling
  // lump; the second, faster and finer, is what makes the surface look alive.
  float low  = snoise(position * uFrequency + vec3(0.0, 0.0, uTime * 0.6));
  float high = snoise(position * uFrequency * 2.3 + vec3(uTime * 0.45, 0.0, 0.0));
  float noise = low * 0.72 + high * 0.28;

  vDisplacement = noise;

  // uBurst spikes to 1 the instant a phase resolves and decays on the CPU
  // side. Scaling the radius rather than the noise makes the whole blob pulse
  // outward as one body, which reads as a reaction; scaling the noise would
  // just make it churn harder, which reads as more of the same.
  float radius = 1.0 + uBurst * 0.22;
  vec3 displaced = position * radius + normal * noise * uAmplitude;

  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);

  // The geometric normal, not a recomputed one. Displacement makes it wrong
  // for diffuse lighting — but nothing here is diffuse. The shading is a
  // view-dependent rim term, where the original normal is what produces the
  // clean silhouette glow instead of a noisy one.
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);

  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uRim;
uniform float uGlow;
uniform float uBurst;

varying float vDisplacement;
varying vec3 vNormalV;
varying vec3 vViewDir;

void main() {
  // Fresnel: near-zero facing the camera, near-one at the silhouette. This is
  // the entire lighting model, and the reason the blob reads as luminous
  // rather than as a lit solid.
  float fresnel = pow(1.0 - max(dot(vNormalV, vViewDir), 0.0), 2.6);

  // Peaks toward the rim colour, troughs toward the core, so the noise is
  // visible as colour as well as shape.
  float height = clamp(vDisplacement * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uCore, uRim, height * 0.85);
  color += uRim * fresnel * uGlow;
  color += uRim * uBurst * 0.9;

  float alpha = clamp(fresnel * 1.15 + 0.4 + uBurst * 0.3, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

export function MeetupBlob({
  phase = 'idle',
  className,
}: {
  phase?: BlobPhase;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Read by the animation loop without re-running the effect. Rebuilding the
  // WebGL context on every phase change would drop the transition entirely —
  // which is the one thing this component exists to render.
  const phaseRef = useRef<BlobPhase>(phase);
  const previousPhaseRef = useRef<BlobPhase>(phase);
  const burstRef = useRef(0);

  useEffect(() => {
    // A phase that RESOLVES something earns the burst. Arming does not: it is a
    // state you sit in for ninety seconds, and a flash every time you enter it
    // would spend the effect on the wrong moment.
    if (
      phase !== previousPhaseRef.current &&
      (phase === 'verified' || phase === 'failed')
    ) {
      burstRef.current = 1;
    }
    previousPhaseRef.current = phase;
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Honoured by not animating at all rather than by animating slowly. A
    // vestibular trigger at half speed is still a trigger.
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      // No WebGL — a locked-down browser, a VM with no GPU. The caller's CSS
      // fallback stays visible underneath rather than a blank hole.
      return;
    }

    // Capped at 2: beyond that a retina phone renders four times the pixels for
    // a glow nobody can resolve, and the frame rate is what the user notices.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3.4;

    const start = LOOKS[phaseRef.current];
    const uniforms = {
      uTime: { value: 0 },
      uAmplitude: { value: start.amplitude },
      uFrequency: { value: start.frequency },
      uGlow: { value: start.glow },
      uBurst: { value: 0 },
      uCore: { value: start.core.clone() },
      uRim: { value: start.rim.clone() },
    };

    // Detail 48 is ~46k triangles. The displacement happens per VERTEX, so too
    // few and the blob is visibly faceted no matter how good the shader is.
    const geometry = new THREE.IcosahedronGeometry(1, 48);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      // Additive, so overlapping rim glow accumulates into light instead of
      // compositing into mud. Depth writes off for the same reason.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const blob = new THREE.Mesh(geometry, material);
    scene.add(blob);

    // A second, larger copy of the same shader as a faint wireframe halo. It
    // moves on the same noise field, so it reads as the blob's own field rather
    // than as decoration parked around it.
    const haloMaterial = material.clone();
    haloMaterial.uniforms = uniforms;
    haloMaterial.wireframe = true;
    haloMaterial.opacity = 0.12;
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.28, 12), haloMaterial);
    scene.add(halo);

    function resize() {
      const { clientWidth, clientHeight } = mount!;
      const size = Math.max(1, Math.min(clientWidth, clientHeight));
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    let clockTime = 0;
    let last = performance.now();

    function tick(now: number) {
      frame = requestAnimationFrame(tick);

      // Delta-timed, not frame-counted. On a 120Hz phone a per-frame increment
      // runs the whole animation at double speed.
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;

      const look = LOOKS[phaseRef.current];
      clockTime += delta * look.speed;
      uniforms.uTime.value = clockTime;

      // Ease toward the target rather than assigning it. `1 - exp(-k*dt)` is
      // frame-rate independent, unlike the usual `x += (target - x) * 0.05`,
      // which settles at different speeds on different displays.
      const ease = 1 - Math.exp(-3.2 * delta);
      uniforms.uAmplitude.value += (look.amplitude - uniforms.uAmplitude.value) * ease;
      uniforms.uFrequency.value += (look.frequency - uniforms.uFrequency.value) * ease;
      uniforms.uGlow.value += (look.glow - uniforms.uGlow.value) * ease;
      uniforms.uCore.value.lerp(look.core, ease);
      uniforms.uRim.value.lerp(look.rim, ease);

      burstRef.current *= Math.exp(-3.6 * delta);
      uniforms.uBurst.value = burstRef.current;

      blob.rotation.y += delta * 0.28;
      blob.rotation.x += delta * 0.11;
      halo.rotation.y -= delta * 0.16;
      halo.rotation.z += delta * 0.07;

      renderer.render(scene, camera);
    }

    if (reduceMotion) {
      // One frame, at a time offset that gives an interesting shape rather than
      // the perfectly smooth sphere t=0 produces.
      uniforms.uTime.value = 12;
      renderer.render(scene, camera);
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      // WebGL resources are not garbage collected with the React tree. Without
      // these the context leaks on every navigation, and browsers cap the
      // number of live contexts — the symptom is the blob silently failing to
      // appear after a dozen route changes.
      geometry.dispose();
      material.dispose();
      halo.geometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-hidden
      // The blob carries no information — the code beside it does. Announcing
      // it would read a decoration to a screen reader and say nothing useful.
    />
  );
}
