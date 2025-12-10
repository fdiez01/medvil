/// <reference types="@react-three/fiber" />
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial, Mesh } from 'three';
import { PALETTE, MobEntity } from '../gameData';

interface MobProps {
  data: MobEntity;
}

export const Mob: React.FC<MobProps> = ({ data }) => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      
      // Update Position
      groupRef.current.position.set(data.position[0], 0, data.position[2]);

      // Floating animation relative to its world position
      groupRef.current.position.y = 0.8 + Math.sin(t * 2) * 0.2;
      // Slow rotation
      groupRef.current.rotation.y += 0.01;

      // FLASH EFFECT
      if (bodyRef.current) {
          const timeSinceHit = t - data.lastHitTime;
          const mat = bodyRef.current.material as MeshStandardMaterial;
          
          if (timeSinceHit < 0.2) {
              mat.color.setHex(0xff0000); // Red
              mat.emissive.setHex(0xff0000);
              mat.emissiveIntensity = 1;
          } else {
              mat.color.set(PALETTE.mob);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
          }
      }
    }
  });

  return (
    <group position={[data.position[0], 0, data.position[2]]}>
        <group ref={groupRef}>
            {/* Body */}
            <mesh ref={bodyRef} castShadow receiveShadow>
                <coneGeometry args={[0.4, 1.2, 8]} />
                <meshStandardMaterial color={PALETTE.mob} roughness={0.9} />
            </mesh>
            
            {/* Glowing Eyes */}
            <mesh position={[0.15, 0.2, 0.15]}>
                <sphereGeometry args={[0.08]} />
                <meshStandardMaterial color={PALETTE.mobEyes} emissive={PALETTE.mobEyes} emissiveIntensity={5} />
            </mesh>
            <mesh position={[-0.15, 0.2, 0.15]}>
                <sphereGeometry args={[0.08]} />
                <meshStandardMaterial color={PALETTE.mobEyes} emissive={PALETTE.mobEyes} emissiveIntensity={5} />
            </mesh>
        </group>
    </group>
  );
};