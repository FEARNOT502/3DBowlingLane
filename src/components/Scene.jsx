import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Lane from './Lane.jsx';

// WASD / QE panning on top of OrbitControls. W/S move along the view direction
// (projected onto the lane), A/D strafe, Q/E (and Space/Shift) raise/lower.
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
    if (k.KeyE || k.Space) move.y += 1;
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

export default function Scene(props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 17, 40], fov: 40, near: 0.1, far: 600 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#070b15']} />
      <fog attach="fog" args={['#070b15', 70, 210]} />

      {/* Lighting tuned to give the oil film a wet, specular sheen. */}
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#cfe0ff', '#120b04', 0.55]} />
      <directionalLight position={[16, 40, 30]} intensity={1.5} />
      <directionalLight position={[-22, 26, -20]} intensity={0.55} color="#a9c5ff" />
      {/* a long fill light down the lane to keep the far end lit */}
      <pointLight position={[0, 14, -20]} intensity={0.4} distance={120} color="#bcd4ff" />

      {/* Dark floor for depth. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#070b15" roughness={1} metalness={0} />
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
    </Canvas>
  );
}
