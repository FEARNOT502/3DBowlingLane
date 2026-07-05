import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Lane from './Lane.jsx';

// WASD / QE panning on top of OrbitControls. W/S move along the view direction
// (projected onto the lane), A/D strafe, E/Shift raise/lower. Space is reserved
// for play/pause (handled in App), so it is deliberately NOT a camera key.
function WasdControls() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const keys = useRef({});

  useEffect(() => {
    const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const down = (e) => {
      if (typing()) return;
      keys.current[e.code] = true;
    };
    const up = (e) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    if (!controls) return;
    const k = keys.current;
    const dt = Math.min(delta, 0.05);
    const speed = 26 * dt;

    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() === 0) return;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (k.KeyW) move.add(fwd);
    if (k.KeyS) move.sub(fwd);
    if (k.KeyD) move.add(right);
    if (k.KeyA) move.sub(right);
    if (k.KeyE) move.y += 1;
    if (k.KeyQ || k.ShiftLeft || k.ShiftRight) move.y -= 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      camera.position.add(move);
      controls.target.add(move);
      controls.update();
    }
  });

  return null;
}

// Camera viewpoints (world units; foul line sits at z≈20, pins at z≈-20).
// `default` is the opening 3/4 view; the rest are one-tap presets.
export const CAMERA_PRESETS = {
  default: { pos: [0, 17, 40], tgt: [0, 0, 2] },
  pov: { pos: [0, 4.6, 31], tgt: [0, 1.6, -18] }, // bowler's eye, down the lane
  side: { pos: [34, 9, 7], tgt: [0, 0, -6] }, // side-on, reads the hook shape
  top: { pos: [0, 54, 2.2], tgt: [0, 0, 2] }, // top-down, reads the line
};

// Animates the camera toward a preset pose when `cmd` changes, then hands
// control back to OrbitControls. `cmd` is an object so re-selecting the same
// preset (new identity) re-triggers the move.
function CameraRig({ cmd }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const goal = useRef(null);

  useEffect(() => {
    if (!cmd || !cmd.id) return;
    const p = CAMERA_PRESETS[cmd.id];
    if (!p) return;
    goal.current = {
      pos: new THREE.Vector3(...p.pos),
      tgt: new THREE.Vector3(...p.tgt),
    };
  }, [cmd]);

  useFrame(() => {
    const g = goal.current;
    if (!g || !controls) return;
    camera.position.lerp(g.pos, 0.1);
    controls.target.lerp(g.tgt, 0.1);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.08 && controls.target.distanceTo(g.tgt) < 0.08) {
      goal.current = null;
    }
  });
  return null;
}

// Studio backdrop per theme: bright airy grey for the light UI, the original
// deep navy for dark mode.
const BACKDROPS = {
  light: { bg: '#e6ebf4', floor: '#dbe2ee', ground: '#c8d2e0', ambient: 0.85 },
  dark: { bg: '#070b15', floor: '#070b15', ground: '#120b04', ambient: 0.6 },
};

export default function Scene({ theme = 'light', cameraCmd, ...props }) {
  const bd = BACKDROPS[theme] || BACKDROPS.light;
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 17, 40], fov: 40, near: 0.1, far: 600 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[bd.bg]} />
      <fog attach="fog" args={[bd.bg, 70, 210]} />

      {/* Lighting tuned to give the oil film a wet, specular sheen. */}
      <ambientLight intensity={bd.ambient} />
      <hemisphereLight args={['#cfe0ff', bd.ground, 0.55]} />
      <directionalLight position={[16, 40, 30]} intensity={1.5} />
      <directionalLight position={[-22, 26, -20]} intensity={0.55} color="#a9c5ff" />
      {/* a long fill light down the lane to keep the far end lit */}
      <pointLight position={[0, 14, -20]} intensity={0.4} distance={120} color="#bcd4ff" />

      {/* Floor for depth. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={bd.floor} roughness={1} metalness={0} />
      </mesh>

      <Suspense fallback={null}>
        <Lane {...props} />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={180}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={[0, 0, 2]}
      />
      <WasdControls />
      <CameraRig cmd={cameraCmd} />
    </Canvas>
  );
}
