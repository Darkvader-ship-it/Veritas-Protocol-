'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function WireframeGrid() {
  const meshRef = useRef<THREE.Group>(null);

  // Create geometric wireframe structures
  const geometries = useMemo(() => {
    const items = [];

    // Main curved dome structure
    const domeGeometry = new THREE.SphereGeometry(15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    items.push({ geometry: domeGeometry, position: [0, -5, 0], rotation: [0, 0, 0] });

    // Grid floor plane
    const planeGeometry = new THREE.PlaneGeometry(40, 40, 40, 40);
    items.push({ geometry: planeGeometry, position: [0, -5, 0], rotation: [-Math.PI / 2, 0, 0] });

    // Parametric curved lines - torus structures
    const torus1 = new THREE.TorusGeometry(8, 0.05, 16, 100);
    items.push({ geometry: torus1, position: [0, 0, 0], rotation: [Math.PI / 2, 0, 0] });

    const torus2 = new THREE.TorusGeometry(12, 0.05, 16, 100);
    items.push({ geometry: torus2, position: [0, -2, 0], rotation: [Math.PI / 2, 0, 0] });

    // Additional architectural elements - vertical pillars
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * 12;
      const z = Math.sin(angle) * 12;
      const cylinder = new THREE.CylinderGeometry(0.05, 0.05, 15, 8);
      items.push({ geometry: cylinder, position: [x, 2.5, z], rotation: [0, 0, 0] });
    }

    return items;
  }, []);

  // Animate the structures
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={meshRef}>
      {geometries.map((item, index) => (
        <mesh
          key={index}
          geometry={item.geometry}
          position={item.position as [number, number, number]}
          rotation={item.rotation as [number, number, number]}
        >
          <meshBasicMaterial
            color="#3b82f6"
            wireframe={true}
            transparent={true}
            opacity={0.15}
          />
        </mesh>
      ))}

      {/* Ambient particles/stars */}
      <Points />
    </group>
  );
}

function Points() {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#60a5fa"
        transparent={true}
        opacity={0.3}
        sizeAttenuation={true}
      />
    </points>
  );
}

export function ThreeBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 5, 20], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        {/* Ambient lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} color="#3b82f6" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />

        {/* 3D Wireframe structures */}
        <WireframeGrid />

        {/* Optional: Enable orbit controls for debugging (remove in production) */}
        {/* <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} /> */}
      </Canvas>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60 pointer-events-none" />
    </div>
  );
}
