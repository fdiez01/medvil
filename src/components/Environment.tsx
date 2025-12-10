/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Fog, DirectionalLight, HemisphereLight, SpotLight, MathUtils } from 'three';
import { ResourceNode, PlantNode, PALETTE, ResourceType } from '../gameData';

interface EnvironmentProps {
  gameHour: number;
  trees: ResourceNode[];
  plants: PlantNode[];
  onNodeClick: (id: number, type: ResourceType, position: [number, number, number]) => void;
  isGathering: boolean;
}

const HOVER_COLOR = "#ffb700"; // Bright Amber for selection

// --- Sub-Components for Clickable Resources ---

const TreeTrunk: React.FC<{ 
  tree: ResourceNode; 
  isGathering: boolean; 
  onClick: (id: number, type: ResourceType, pos: [number, number, number]) => void 
}> = ({ tree, isGathering, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const active = isGathering && hovered;
  const color = active ? HOVER_COLOR : PALETTE.treeTrunk;

  return (
    <group 
        onClick={(e) => { e.stopPropagation(); onClick(tree.id, 'wood', tree.position); }}
        onPointerOver={(e) => { if (isGathering) { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; } }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
    >
        <mesh position={[0, 1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.25, 2, 6]} />
            <meshStandardMaterial color={color} />
        </mesh>
    </group>
  );
};

const TreeFoliage: React.FC<{ 
  tree: ResourceNode; 
  isGathering: boolean; 
  onClick: (id: number, type: ResourceType, pos: [number, number, number]) => void 
}> = ({ tree, isGathering, onClick }) => {
  const [hovered, setHovered] = useState(false);
  
  // Only selectable if food is available
  const canGather = isGathering && tree.available.food;
  const active = canGather && hovered;

  const color = active ? HOVER_COLOR : PALETTE.treeLeaves;
  const appleColor = active ? HOVER_COLOR : "#ff3333";

  return (
    <group 
        position={[0, 2.5, 0]}
        onClick={(e) => { 
            e.stopPropagation(); 
            if (tree.available.food) {
                onClick(tree.id, 'food', tree.position); 
            }
        }}
        onPointerOver={(e) => { 
            if (canGather) { 
                e.stopPropagation(); 
                setHovered(true); 
                document.body.style.cursor = 'pointer'; 
            } 
        }}
        onPointerOut={(e) => { 
            e.stopPropagation(); 
            setHovered(false); 
            document.body.style.cursor = 'auto'; 
        }}
    >
        <mesh castShadow>
            <dodecahedronGeometry args={[1.2, 0]} />
            <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.7, 0]} castShadow>
            <dodecahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        
        {/* Apples */}
        {tree.available.food && (
            <>
                <mesh position={[0.9, 0, 0.2]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
                <mesh position={[-0.8, 0.3, 0.4]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
                <mesh position={[0, -0.2, -1.0]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
                {/* Additional Apples for natural look */}
                <mesh position={[0.4, 0.6, 0.6]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
                 <mesh position={[-0.4, -0.5, -0.6]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
                 <mesh position={[0.2, 0.8, -0.4]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
                <mesh position={[-0.7, 0.1, -0.5]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color={appleColor} />
                </mesh>
            </>
        )}
    </group>
  );
};

const PlantCluster: React.FC<{ 
  plant: PlantNode; 
  isGathering: boolean; 
  onClick: (id: number, type: ResourceType, pos: [number, number, number]) => void 
}> = ({ plant, isGathering, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const active = isGathering && hovered;
  
  const flowerColor = active ? HOVER_COLOR : "#9932cc";
  const leafColor = active ? HOVER_COLOR : "#2d5a27";

  // Use useMemo to ensure random rotation is calculated only once per plant instance
  const randomRotation = useMemo(() => Math.random() * Math.PI, []);

  return (
     <group 
        position={plant.position}
        onClick={(e) => { e.stopPropagation(); onClick(plant.id, 'plants', plant.position); }}
        onPointerOver={(e) => { if (isGathering) { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; } }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
     >
        <group rotation={[0, randomRotation, 0]}>
            <mesh castShadow position={[0, 0.2, 0]}>
                <octahedronGeometry args={[0.2]} />
                <meshStandardMaterial color={flowerColor} />
            </mesh>
            <mesh position={[0.2, 0.1, 0]} rotation={[0,0,0.5]}>
                <octahedronGeometry args={[0.15]} />
                <meshStandardMaterial color={leafColor} />
            </mesh>
            <mesh position={[-0.2, 0.1, 0]} rotation={[0,0,-0.5]}>
                <octahedronGeometry args={[0.15]} />
                <meshStandardMaterial color={leafColor} />
            </mesh>
        </group>
     </group>
  );
};

// --- Main Environment Component ---

export const Environment: React.FC<EnvironmentProps> = ({ gameHour, trees, plants, onNodeClick, isGathering }) => {
  const dirLightRef = useRef<DirectionalLight>(null);
  const hemiLightRef = useRef<HemisphereLight>(null);
  
  useFrame(({ scene }) => {
    // --- TIME CALCULATION ---
    // Shift the cycle so 5am is start of dawn, 13pm is noon peak, 21pm is sunset end.
    // 5 to 21 = 16 hours of "daylight" curve.
    
    let dayIntensity = 0;
    if (gameHour >= 5 && gameHour <= 21) {
        // Create a sine wave that starts at 0 at 5h, peaks at 13h, ends at 0 at 21h
        // (hour - 5) goes from 0 to 16.
        // PI * (hour - 5) / 16 goes from 0 to PI.
        // sin(0) = 0, sin(PI/2) = 1, sin(PI) = 0.
        dayIntensity = Math.sin((gameHour - 5) * Math.PI / 16);
    }
    
    const nightIntensity = 1 - dayIntensity;

    // --- COLORS ---
    const skyColor = new Color();
    const daySky = new Color(PALETTE.skyDay);
    const nightSky = new Color(PALETTE.skyNight);
    const duskSky = new Color(PALETTE.skyDusk);

    // Mix colors based on time for smoother sky
    if (dayIntensity > 0.8) {
         skyColor.copy(daySky);
    } else if (dayIntensity > 0) {
         // Interpolate Day -> Dusk -> Night
         skyColor.copy(nightSky).lerp(duskSky, dayIntensity * 2).lerp(daySky, dayIntensity);
    } else {
         skyColor.copy(nightSky);
    }
    
    scene.background = skyColor;
    
    // --- FOG ---
    if (!scene.fog) scene.fog = new Fog(skyColor, 0, 0);
    const fog = scene.fog as Fog;
    fog.color.copy(skyColor);
    
    // Day Fog: Far (50), Night Fog: Farther (60) to see clearly, but Darker color handles the mood.
    // Actually user wanted "clearer night".
    const targetNear = 10 + dayIntensity * 5; // 10 at night, 15 at day
    const targetFar = 60 - dayIntensity * 10; // 60 at night (clearer), 50 at day
    
    fog.near = MathUtils.lerp(fog.near, targetNear, 0.05);
    fog.far = MathUtils.lerp(fog.far, targetFar, 0.05);

    // --- LIGHTS ---
    if (dirLightRef.current && hemiLightRef.current) {
        // Sun Movement
        const sunAngle = ((gameHour - 13) / 24) * Math.PI * 2; // Noon (13h) = 0 angle (top)
        const radius = 20;
        const sunX = Math.sin(sunAngle) * radius;
        const sunY = Math.cos(sunAngle) * radius;
        
        dirLightRef.current.position.set(sunX, sunY, 10);
        
        // Directional Light Color/Intensity
        if (dayIntensity > 0) {
            dirLightRef.current.color.setHSL(0.1, 0.5, 0.7);
            dirLightRef.current.intensity = MathUtils.lerp(dirLightRef.current.intensity, dayIntensity * 1.5, 0.05);
        } else {
            // Moonlight
            dirLightRef.current.color.set("#b0c4de"); // Light Steel Blue
            dirLightRef.current.intensity = MathUtils.lerp(dirLightRef.current.intensity, 0.4, 0.05);
        }

        // Ambient / Hemisphere Light (Base Visibility)
        // Night Ambient needs to be higher for visibility (~0.4)
        // Day Ambient (~0.6)
        const targetHemiIntensity = 0.4 + (dayIntensity * 0.4); 
        hemiLightRef.current.intensity = MathUtils.lerp(hemiLightRef.current.intensity, targetHemiIntensity, 0.05);
        
        const groundColorDay = new Color(PALETTE.ground);
        const groundColorNight = new Color("#0f1219"); // Slightly lighter black
        hemiLightRef.current.groundColor.lerpColors(groundColorNight, groundColorDay, dayIntensity);
        
        const skyColorRef = new Color().copy(skyColor).multiplyScalar(0.8);
        hemiLightRef.current.color.copy(skyColorRef);
    }
  });

  return (
    <>
      <ambientLight intensity={0.2} /> {/* Base base light */}
      <hemisphereLight ref={hemiLightRef} />
      <directionalLight ref={dirLightRef} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={PALETTE.ground} />
      </mesh>

      {/* Scattered Plants */}
      {plants.map((plant) => plant.available && (
         <PlantCluster 
            key={plant.id} 
            plant={plant} 
            isGathering={isGathering} 
            onClick={onNodeClick} 
         />
      ))}

      {/* Trees */}
      {trees.map((tree) => (
        <group key={tree.id} position={tree.position}>
          <TreeTrunk tree={tree} isGathering={isGathering} onClick={onNodeClick} />
          <TreeFoliage tree={tree} isGathering={isGathering} onClick={onNodeClick} />
        </group>
      ))}
    </>
  );
};