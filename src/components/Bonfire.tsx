/// <reference types="@react-three/fiber" />
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group, PointLight } from 'three';
import { PALETTE } from '../gameData';

interface BonfireProps {
  timeLeft: number; // 0 if out, >0 if burning
}

export const Bonfire: React.FC<BonfireProps> = ({ timeLeft }) => {
  const lightRef = useRef<PointLight>(null);
  const particlesRef = useRef<Group>(null);
  const isBurning = timeLeft > 0;

  // Initial random positions for particles
  const particleCount = 8;
  const initialParticles = useMemo(() => {
    return new Array(particleCount).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 0.5,
      y: Math.random() * 1.5,
      z: (Math.random() - 0.5) * 0.5,
      speed: 0.5 + Math.random() * 1,
      offset: Math.random() * 100
    }));
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (isBurning && lightRef.current) {
      // Flicker effect - Increased Base Intensity (2.5) and Range (25)
      lightRef.current.intensity = 2.5 + Math.sin(time * 15) * 0.5 + Math.cos(time * 23) * 0.3;
      lightRef.current.distance = 25 + Math.sin(time * 2) * 2;
    } else if (lightRef.current) {
        lightRef.current.intensity = 0;
    }

    if (isBurning && particlesRef.current) {
      particlesRef.current.children.forEach((mesh, i) => {
        const data = initialParticles[i];
        const y = (time * data.speed + data.offset) % 2.5;
        // Spiral motion
        mesh.position.y = y;
        mesh.position.x = data.x + Math.sin(time * 3 + i) * 0.1 * y;
        mesh.position.z = data.z + Math.cos(time * 3 + i) * 0.1 * y;
        const scale = Math.max(0, 1 - y / 2.0) * 0.15;
        mesh.scale.setScalar(scale);
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Wood Logs Base */}
      <group position={[0, 0.1, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2.3]} position={[0, 0, 0.2]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.8]} />
            <meshStandardMaterial color="#3d2817" />
        </mesh>
        <mesh rotation={[0, 2, Math.PI / 2.2]} position={[0.1, 0, -0.1]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.8]} />
            <meshStandardMaterial color="#3d2817" />
        </mesh>
        <mesh rotation={[0, -2, Math.PI / 2.4]} position={[-0.1, 0, -0.1]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.8]} />
            <meshStandardMaterial color="#3d2817" />
        </mesh>
      </group>

      {isBurning && (
        <>
          {/* Main Fire Core */}
          <mesh position={[0, 0.4, 0]}>
            <coneGeometry args={[0.3, 0.8, 6]} />
            <meshStandardMaterial color={PALETTE.fire} emissive={PALETTE.fire} emissiveIntensity={2} transparent opacity={0.8} />
          </mesh>
          <pointLight ref={lightRef} color="#ffaa00" distance={25} decay={2} castShadow position={[0, 1, 0]} />
          
          {/* Particles */}
          <group ref={particlesRef}>
            {initialParticles.map((_, i) => (
              <mesh key={i}>
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color="#ffff00" />
              </mesh>
            ))}
          </group>
        </>
      )}
    </group>
  );
};