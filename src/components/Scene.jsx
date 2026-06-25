import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Lane from './Lane.jsx';

export default function Scene(props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [11, 15, 42], fov: 40, near: 0.1, far: 600 }}
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
    </Canvas>
  );
}
