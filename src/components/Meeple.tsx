import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3, MeshStandardMaterial } from 'three';
import { Meeple as MeepleType, PALETTE } from '../gameData';
import { Text, Billboard } from '@react-three/drei';

interface MeepleProps {
  data: MeepleType;
  isSelected: boolean;
  onClick: () => void;
}

export const Meeple: React.FC<MeepleProps> = ({ data, isSelected, onClick }) => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const leftShoulderRef = useRef<Group>(null);
  const rightShoulderRef = useRef<Group>(null);
  const ritualParticlesRef = useRef<Group>(null);
  const combatParticlesRef = useRef<Group>(null);

  // Helper to safely look at a target without breaking the matrix
  const safeLookAt = (target: Vector3 | [number, number, number]) => {
      if (!groupRef.current) return;
      
      const tx = Array.isArray(target) ? target[0] : target.x;
      const tz = Array.isArray(target) ? target[2] : target.z;
      const currentPos = groupRef.current.position;

      // 1. Input Validation
      if (isNaN(tx) || isNaN(tz)) return;

      // 2. Distance Threshold
      // Do NOT look if too close. This prevents the "LookAt Zero" bug which generates NaNs.
      // Increased threshold to 0.5 to be extremely safe.
      const distSq = (tx - currentPos.x)**2 + (tz - currentPos.z)**2;
      if (distSq < 0.25) return; 

      // 3. Execute LookAt on flattened plane
      // Creating a new Vector3 every frame is fine, JS engines handle this well.
      // We force Y to match current Y to prevent tilting.
      const targetVec = new Vector3(tx, currentPos.y, tz);
      groupRef.current.lookAt(targetVec);
  };

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speed = 10;
    
    if (groupRef.current) {
      // --- ANTI-VANISH SYSTEM ---
      // Check for corrupted matrix (NaNs) which causes disappearance
      const p = groupRef.current.position;
      const q = groupRef.current.quaternion;
      
      if (isNaN(p.x) || isNaN(p.y) || isNaN(p.z) || isNaN(q.x) || isNaN(q.y) || isNaN(q.z) || isNaN(q.w)) {
          // Emergency Reset
          console.warn(`[Physics Correction] Resetting corrupted matrix for ${data.name}`);
          groupRef.current.quaternion.identity();
          groupRef.current.position.set(...data.basePosition);
          groupRef.current.scale.set(1,1,1);
      }

      // --- POSITION UPDATE ---
      if (!isNaN(data.position[0]) && !isNaN(data.position[1]) && !isNaN(data.position[2])) {
          groupRef.current.position.set(...data.position);
      }
      
      // --- ORIENTATION LOGIC ---
      if (data.action === 'MOVING' && data.targetPosition) {
         safeLookAt(data.targetPosition);
      } else if (data.action === 'RETURNING') {
         safeLookAt(data.basePosition);
      } else if (data.action === 'CHOPPING' || data.action === 'GATHERING') {
          if (data.targetPosition) {
              safeLookAt(data.targetPosition);
          }
      }
      // Combat/Idle logic handled implicitly
    }

    // --- VISUAL EFFECTS ---
    const timeSinceHit = t - data.lastHitTime;

    // 1. Red Flash on Hit (lasts 0.2s)
    if (bodyRef.current) {
        const mat = bodyRef.current.material as MeshStandardMaterial;
        if (timeSinceHit < 0.2) {
            mat.color.set('red');
            mat.emissive.set('red');
            mat.emissiveIntensity = 0.5;
        } else {
            mat.color.set(data.color);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
        }
    }

    // 2. Combat Particle Burst (lasts 0.5s)
    if (combatParticlesRef.current) {
        if (timeSinceHit < 0.5) {
            combatParticlesRef.current.visible = true;
            // Expand particles
            combatParticlesRef.current.children.forEach((mesh, i) => {
                const dir = (i / 8) * Math.PI * 2;
                const expandSpeed = 3 * timeSinceHit;
                mesh.position.x = Math.sin(dir) * expandSpeed;
                mesh.position.z = Math.cos(dir) * expandSpeed;
                mesh.position.y = Math.sin(timeSinceHit * 10) * 0.5; // Arcing up
                const scale = Math.max(0, 1 - timeSinceHit * 2);
                mesh.scale.setScalar(scale * 0.2);
            });
        } else {
            combatParticlesRef.current.visible = false;
        }
    }

    // 3. Stumble/Wobble Animation (lasts 1.0s after hit, if wounded/infected)
    if (groupRef.current && data.action === 'RETURNING' && (data.status === 'Wounded' || data.status === 'Infected')) {
        if (timeSinceHit < 1.0) {
            // Add noise to rotation
            groupRef.current.rotation.z = Math.sin(t * 20) * 0.2; // Fast wobble
            groupRef.current.rotation.x = Math.cos(t * 15) * 0.1; 
        } else {
            // Smoothly reset
             groupRef.current.rotation.z *= 0.9;
             groupRef.current.rotation.x *= 0.9;
        }
    }

    // --- ANIMATIONS ---

    // 1. Squash & Stretch (Walking)
    const isWalking = data.action === 'MOVING' || data.action === 'RETURNING';
    
    if (isWalking && bodyRef.current) {
      const hop = Math.abs(Math.sin(t * speed)) * 0.2;
      bodyRef.current.position.y = 0.5 + hop;
      bodyRef.current.scale.set(1 - hop * 0.2, 1 + hop * 0.1, 1 - hop * 0.2);
    } else if (bodyRef.current) {
       bodyRef.current.position.y = 0.5;
       bodyRef.current.scale.set(1, 1, 1);
    }

    // 2. Arm Movements
    if (leftShoulderRef.current && rightShoulderRef.current) {
        let leftZ = 0.3; // A-Pose
        let rightZ = -0.3; // A-Pose
        let leftX = 0;
        let rightX = 0;

        if (isWalking) {
            leftX = Math.sin(t * speed) * 0.8;
            rightX = -Math.sin(t * speed) * 0.8;
        } else if (data.action === 'CHOPPING' || data.action === 'GATHERING') {
            rightX = Math.sin(t * 15) * 1.5; // Hacking motion
            leftX = Math.cos(t * 15) * 0.5;
        } else if (data.action === 'EATING') {
            rightZ = -2.5 + Math.sin(t * 10) * 0.5; // Hand to mouth
        } else if (data.action === 'RITUAL') {
            leftZ = 2.8; // Arms up
            rightZ = -2.8;
        } else if (data.action === 'SLEEPING') {
            if(groupRef.current) groupRef.current.rotation.x = -Math.PI / 2;
        }

        leftShoulderRef.current.rotation.z = leftZ;
        leftShoulderRef.current.rotation.x = leftX;
        rightShoulderRef.current.rotation.z = rightZ;
        rightShoulderRef.current.rotation.x = rightX;
    }

    // 3. Ritual Particles
    if (data.action === 'RITUAL' && ritualParticlesRef.current) {
        ritualParticlesRef.current.rotation.y += 0.05;
        ritualParticlesRef.current.visible = true;
    } else if (ritualParticlesRef.current) {
        ritualParticlesRef.current.visible = false;
    }

    // Reset rotation if not sleeping AND not stumbling (Important!)
    if (data.action !== 'SLEEPING' && timeSinceHit >= 1.0 && groupRef.current && groupRef.current.rotation.x !== 0 && Math.abs(groupRef.current.rotation.x) > 0.01) {
        // Only force reset if we are done stumbling and not sleeping
         groupRef.current.rotation.x = 0;
         groupRef.current.rotation.z = 0;
    }
  });

  // Status Indicator Color
  const statusColor = useMemo(() => {
    switch(data.status) {
        case 'Infected': return 'lime';
        case 'Wounded': return 'red';
        case 'Tired': return 'gray';
        case 'Fit': return 'gold';
        default: return null;
    }
  }, [data.status]);

  return (
    <group>
        <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {/* Selection Ring */}
        {isSelected && (
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 32]} />
            <meshBasicMaterial color="yellow" opacity={0.5} transparent />
            </mesh>
        )}

        {/* Status Indicator */}
        {statusColor && (
            <Billboard position={[0, 2.2, 0]}>
                 <mesh>
                    <sphereGeometry args={[0.15]} />
                    <meshBasicMaterial color={statusColor} />
                 </mesh>
            </Billboard>
        )}
        
        {/* Name Tag */}
        <Billboard position={[0, 1.8, 0]}>
            <Text fontSize={0.2} color="white" outlineWidth={0.02} outlineColor="black">
                {data.name}
            </Text>
        </Billboard>

        {/* Body Group */}
        <mesh ref={bodyRef} castShadow receiveShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.2, 0.4, 0.8]} />
            <meshStandardMaterial color={data.color} />
            
            {/* Head */}
            <mesh position={[0, 0.6, 0]}>
                <icosahedronGeometry args={[0.25, 0]} />
                <meshStandardMaterial color={PALETTE.meepleSkin} />
            </mesh>

            {/* Left Shoulder Pivot */}
            <group ref={leftShoulderRef} position={[0.25, 0.35, 0]}>
                <mesh position={[0, -0.25, 0]}>
                    <capsuleGeometry args={[0.08, 0.4]} />
                    <meshStandardMaterial color={data.color} />
                </mesh>
            </group>

            {/* Right Shoulder Pivot */}
            <group ref={rightShoulderRef} position={[-0.25, 0.35, 0]}>
                <mesh position={[0, -0.25, 0]}>
                    <capsuleGeometry args={[0.08, 0.4]} />
                    <meshStandardMaterial color={data.color} />
                </mesh>
            </group>
        </mesh>

        {/* Combat Particles */}
        <group ref={combatParticlesRef} visible={false} position={[0, 0.5, 0]}>
            {[...Array(8)].map((_, i) => (
                <mesh key={i}>
                    <boxGeometry args={[0.1, 0.1, 0.1]} />
                    <meshBasicMaterial color="red" />
                </mesh>
            ))}
        </group>

        {/* Ritual Particles Container */}
        <group ref={ritualParticlesRef} visible={false}>
             {[0, 1, 2].map(i => (
                 <mesh key={i} position={[Math.sin(i*2)*0.8, 1.5, Math.cos(i*2)*0.8]}>
                     <octahedronGeometry args={[0.1]} />
                     <meshBasicMaterial color="cyan" />
                 </mesh>
             ))}
        </group>
        </group>
    </group>
  );
};