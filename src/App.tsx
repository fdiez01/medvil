import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GameState, Meeple as MeepleType, ResourceNode, PlantNode, MobEntity, CHAR_SPEED, MOB_SPEED, MOB_DASH_SPEED, DAY_LENGTH_SECONDS, ResourceType } from './gameData';
import { Bonfire } from './components/Bonfire';
import { Meeple } from './components/Meeple';
import { Mob } from './components/Mob';
import { Environment } from './components/Environment';

// --- Helper Math ---
const distance = (p1: number[], p2: number[]) => Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
// const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

const INITIAL_GAME_STATE: GameState = {
  day: 1,
  hour: 8,
  population: 3,
  wood: 10,
  food: 10,
  plants: 2,
  fireTimeLeft: 5,
  logs: ['Welcome to Medvil. Select a character.'],
};

const UI_BUTTON_CLASS = "bg-stone-700 hover:bg-stone-600 text-white text-xs font-bold py-2 px-2 rounded border-b-4 border-stone-900 active:border-b-0 active:mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-0 disabled:mt-1 w-full transition-all";

export const App = () => {
  // --- STATE (UI) ---
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [meeples, setMeeples] = useState<MeepleType[]>([]);
  const [trees, setTrees] = useState<ResourceNode[]>([]);
  const [plants, setPlants] = useState<PlantNode[]>([]);
  const [mobs, setMobs] = useState<MobEntity[]>([]);
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // --- REFS (GAME LOGIC TRUTH) ---
  // The loop reads/writes these. React syncs from them.
  const meeplesRef = useRef<MeepleType[]>([]);
  const mobsRef = useRef<MobEntity[]>([]);
  const treesRef = useRef<ResourceNode[]>([]);
  const plantsRef = useRef<PlantNode[]>([]);
  const gameStateRef = useRef<GameState>(INITIAL_GAME_STATE);

  // --- LOGGING HELPER ---
  const queueLog = (msg: string) => {
      gameStateRef.current.logs = [msg, ...gameStateRef.current.logs].slice(0, 5);
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // Init Data
    const initialMeeples: MeepleType[] = [
      { id: 1, name: 'Haldor', role: 'Chef', status: 'Fit', position: [2, 0, 2], basePosition: [2, 0, 2], targetPosition: null, action: 'IDLE', actionTargetId: null, targetResource: null, actionTimer: 0, stunTimer: 0, color: '#4a6fa5', lastHitTime: -999 },
      { id: 2, name: 'Elara', role: 'Priestess', status: 'Normal', position: [-2, 0, 2], basePosition: [-2, 0, 2], targetPosition: null, action: 'IDLE', actionTargetId: null, targetResource: null, actionTimer: 0, stunTimer: 0, color: '#a54a6f', lastHitTime: -999 },
      { id: 3, name: 'Barnaby', role: 'Drunkard', status: 'Tired', position: [0, 0, -3], basePosition: [0, 0, -3], targetPosition: null, action: 'IDLE', actionTargetId: null, targetResource: null, actionTimer: 0, stunTimer: 0, color: '#6fa54a', lastHitTime: -999 },
    ];
    
    // --- Denser Forest Generation ---
    const newTrees: ResourceNode[] = [];
    let attempts = 0;
    while(newTrees.length < 60 && attempts < 1000) {
      attempts++;
      const r = 6 + Math.random() * 44; 
      const theta = Math.random() * Math.PI * 2;
      const x = r * Math.sin(theta);
      const z = r * Math.cos(theta);
      
      if (!newTrees.some(t => distance([x,0,z], t.position) < 3.0)) {
          newTrees.push({
            id: attempts + 100, type: 'Tree', position: [x, 0, z],
            available: { wood: true, food: Math.random() > 0.75 }
          });
      }
    }

    const newPlants: PlantNode[] = [];
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 20;
        newPlants.push({ id: i + 2000, type: 'Plant', position: [Math.sin(angle) * dist, 0, Math.cos(angle) * dist], available: true });
    }

    // --- Complex Mobs ---
    const newMobs: MobEntity[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      // Start closer (11-14m) so they are immediately visible but outside camp
      const dist = 11 + Math.random() * 3; 
      newMobs.push({ 
          id: i + 1000, 
          position: [Math.sin(angle) * dist, 0, Math.cos(angle) * dist], 
          angle: angle + Math.PI / 2, 
          speed: MOB_SPEED, 
          state: 'PATROL', 
          waitTimer: 0,
          dashTarget: null,
          targetMeepleId: null, 
          lastHitTime: -999 
      });
    }

    meeplesRef.current = initialMeeples;
    mobsRef.current = newMobs;
    treesRef.current = newTrees;
    plantsRef.current = newPlants;
    gameStateRef.current = INITIAL_GAME_STATE;

    setMeeples(initialMeeples);
    setMobs(newMobs);
    setTrees(newTrees);
    setPlants(newPlants);
    setGameState(INITIAL_GAME_STATE);
  }, []);

  // --- GAME LOOP (High Performance) ---
  const GameLoop = () => {
    useFrame((state, delta) => {
      const safeDelta = Math.min(delta, 0.1);
      const currentTime = state.clock.getElapsedTime();
      
      // 1. Time & Environment Logic
      const gs = gameStateRef.current;
      const timePassed = (safeDelta / DAY_LENGTH_SECONDS) * 24;
      gs.hour += timePassed;
      if (gs.hour >= 24) { gs.hour = 0; gs.day++; }
      gs.fireTimeLeft = Math.max(0, gs.fireTimeLeft - timePassed);

      const isNight = gs.hour < 6 || gs.hour > 20;

      // 2. Mob Logic 
      const mobs = mobsRef.current;
      const meeples = meeplesRef.current;
      
      // --- DYNAMIC PATROL RADIUS LOGIC ---
      let exclusionRadius = 13.0; // Default Day: Patrol far (~13m)
      
      if (gs.fireTimeLeft > 0) {
          exclusionRadius = 10.0; // Fire on: Pushed back to safety line (~10m)
      } else if (isNight) {
          exclusionRadius = 5.5; // Night + No Fire: CREEPING CLOSE (~5.5m)
      }

      const patrolOuterRadius = exclusionRadius + 5.0; 

      mobs.forEach(mob => {
          if (mob.state === 'WAIT') {
              mob.waitTimer -= safeDelta;
              // Idle breath
              if (mob.waitTimer <= 0) {
                  mob.state = 'PATROL';
              }
          } 
          else if (mob.state === 'ATTACK_DASH') {
              // --- DASH ATTACK LOGIC ---
              if (mob.dashTarget) {
                  const dx = mob.dashTarget[0] - mob.position[0];
                  const dz = mob.dashTarget[2] - mob.position[2];
                  const distToTarget = Math.sqrt(dx*dx + dz*dz);
                  
                  if (distToTarget < 0.5) {
                      // ARRIVED AT DASH TARGET
                      // Check for collision with ANY meeple close to this spot
                      let hit = false;
                      meeples.forEach(m => {
                          const dist = distance(m.position, mob.position);
                          if (dist < 1.5 && (currentTime - m.lastHitTime > 1.0)) {
                              // HIT!
                              m.status = (isNight && Math.random() > 0.6) ? 'Infected' : 'Wounded';
                              m.lastHitTime = currentTime;
                              
                              // STUN LOGIC FIX: 
                              // 1. Set Timer to 1.0s (freeze)
                              // 2. Set Action to RETURNING immediately (so they run after freeze)
                              m.stunTimer = 1.0; 
                              m.action = 'RETURNING'; 
                              m.targetPosition = null; // Forces recalculation to basePosition
                              m.actionTargetId = null; // Drop what they were holding
                              m.actionTimer = 0;
                              
                              mob.lastHitTime = currentTime;
                              hit = true;
                              queueLog(`💥 ${m.name} STUNNED! Fleeing...`);
                          }
                      });
                      
                      // After Dash (Hit or Miss), Flee
                      mob.state = 'FLEEING';
                      mob.dashTarget = null;
                  } else {
                      // Move fast
                      const moveDist = MOB_DASH_SPEED * safeDelta;
                      mob.position[0] += (dx / distToTarget) * moveDist;
                      mob.position[2] += (dz / distToTarget) * moveDist;
                      mob.angle = Math.atan2(dx, dz);
                  }
              } else {
                  mob.state = 'PATROL'; // Safety fallback
              }
          }
          else if (mob.state === 'FLEEING') {
               // --- FLEE LOGIC ---
               // Run away from camp center until safely in patrol zone
               const distFromCenter = Math.sqrt(mob.position[0]**2 + mob.position[2]**2);
               
               if (distFromCenter > patrolOuterRadius - 2.0) {
                   mob.state = 'PATROL'; // Safe now
               } else {
                   // Run outwards
                   const rx = mob.position[0] / (distFromCenter || 1);
                   const rz = mob.position[2] / (distFromCenter || 1);
                   
                   mob.position[0] += rx * MOB_DASH_SPEED * 0.6 * safeDelta;
                   mob.position[2] += rz * MOB_DASH_SPEED * 0.6 * safeDelta;
                   mob.angle = Math.atan2(rx, rz);
               }
          }
          else {
              // --- PATROL LOGIC ---
              
              // 1. Check for Aggro Opportunity
              // STRICT RULE: Dist < 2.5 (Very Close) AND Vision Cone < 40deg (Dot > 0.75)
              for (const meeple of meeples) {
                  if (meeple.status === 'Dead' || meeple.stunTimer > 0) continue;
                  
                  const dist = distance(mob.position, meeple.position);
                  
                  if (dist < 2.5) {
                      // Vector to meeple
                      const dx = meeple.position[0] - mob.position[0];
                      const dz = meeple.position[2] - mob.position[2];
                      
                      // Mob forward vector
                      const fx = Math.sin(mob.angle);
                      const fz = Math.cos(mob.angle);
                      
                      const dot = (fx * (dx/dist)) + (fz * (dz/dist));
                      
                      // AGGRO TRIGGER
                      if (dot > 0.75) {
                          mob.state = 'ATTACK_DASH';
                          mob.dashTarget = [...meeple.position];
                          queueLog(`⚔️ Mob spotted ${meeple.name}! Dashing!`);
                          break; // Focus on this one
                      }
                  }
              }

              // 2. Normal Patrol Movement (if not dashing)
              if (mob.state === 'PATROL') {
                  const distFromCenter = Math.sqrt(mob.position[0]**2 + mob.position[2]**2);
                  const rx = mob.position[0] / (distFromCenter || 1);
                  const rz = mob.position[2] / (distFromCenter || 1);
                  const tx = -rz; // Tangent
                  const tz = rx;

                  let moveX = 0;
                  let moveZ = 0;
                  let moveSpeed = mob.speed;

                  if (distFromCenter < exclusionRadius) {
                      // Retreat (slower than flee, just adjustment)
                      moveX = rx; moveZ = rz;
                  } else if (distFromCenter > patrolOuterRadius) {
                      // Spiral In
                      moveX = tx * 0.7 - rx * 0.3;
                      moveZ = tz * 0.7 - rz * 0.3;
                  } else {
                      // Orbit
                      moveX = tx; moveZ = tz;
                      moveX += (Math.random() - 0.5) * 0.2;
                      moveZ += (Math.random() - 0.5) * 0.2;
                      
                      if (Math.random() < 0.005) { 
                          mob.state = 'WAIT';
                          mob.waitTimer = 1.0 + Math.random() * 2.0;
                          mob.angle = Math.atan2(-mob.position[0], -mob.position[2]);
                          return;
                      }
                  }

                  const len = Math.sqrt(moveX**2 + moveZ**2) || 1;
                  const dx = (moveX / len) * moveSpeed * safeDelta;
                  const dz = (moveZ / len) * moveSpeed * safeDelta;

                  mob.position[0] += dx;
                  mob.position[2] += dz;
                  
                  if (distFromCenter < exclusionRadius) mob.angle = Math.atan2(rx, rz);
                  else mob.angle = Math.atan2(dx, dz);
              }
          }
      });

      // 3. Meeple Logic
      let uiUpdateNeeded = false; 

      meeples.forEach(m => {
          // --- STUN LOGIC ---
          if (m.stunTimer > 0) {
              m.stunTimer -= safeDelta;
              // Wobble effect is handled in visual component
              return; // SKIP ALL MOVEMENT/ACTIONS until timer is done
          }

          // --- Movement Logic ---
          const isMoving = m.action === 'MOVING' || m.action === 'RETURNING';
          const targetPos = m.action === 'MOVING' ? m.targetPosition : m.action === 'RETURNING' ? m.basePosition : null;

          if (isMoving && targetPos) {
              const d = distance(m.position, targetPos);
              const threshold = (m.action === 'MOVING' && m.actionTargetId !== -999) ? 1.6 : 0.6;

              if (d < threshold) {
                  if (m.action === 'RETURNING') {
                      m.action = 'IDLE';
                      m.position = [...m.basePosition];
                  } else {
                      m.action = m.actionTargetId === -999 ? 'LIGHTING_FIRE' : (m.targetResource === 'wood' ? 'CHOPPING' : 'GATHERING');
                      m.actionTimer = 0;
                  }
              } else {
                  let dx = targetPos[0] - m.position[0];
                  let dz = targetPos[2] - m.position[2];
                  const len = Math.sqrt(dx*dx + dz*dz) || 0.001;
                  dx /= len; dz /= len;

                  if (d > 2.5) {
                      trees.forEach(t => {
                          if (t.id === m.actionTargetId) return;
                          const td = distance(m.position, t.position);
                          if (td < 2.0) {
                              const push = (2.0 - td) / 2.0;
                              dx += (m.position[0] - t.position[0]) * push * 2.5;
                              dz += (m.position[2] - t.position[2]) * push * 2.5;
                          }
                      });
                  }
                  
                  const flen = Math.sqrt(dx*dx + dz*dz) || 0.001;
                  let speed = CHAR_SPEED * safeDelta * ((m.status === 'Wounded' || m.status === 'Tired') ? 0.6 : 1.0);
                  
                  const nx = m.position[0] + (dx / flen) * speed;
                  const nz = m.position[2] + (dz / flen) * speed;
                  
                  if (!isNaN(nx) && !isNaN(nz)) {
                      m.position[0] = nx;
                      m.position[2] = nz;
                  }
              }
          }
          // --- Action Logic ---
          else if (m.action === 'CHOPPING' || m.action === 'GATHERING' || m.action === 'LIGHTING_FIRE') {
              m.actionTimer += safeDelta;
              
              if (m.actionTimer > 1.0) {
                  const bonus = m.status === 'Fit' ? 2 : 1;
                  
                  if (m.action === 'LIGHTING_FIRE') {
                      gs.fireTimeLeft += 12;
                      queueLog("Fire lit.");
                      uiUpdateNeeded = true;
                  } else {
                      const tId = m.actionTargetId;
                      if (m.targetResource === 'wood') {
                           if (trees.some(t => t.id === tId)) {
                               gs.wood += 6 * bonus;
                               queueLog(`${m.name} got wood.`);
                               uiUpdateNeeded = true;
                           }
                      } else if (m.targetResource === 'food') {
                           const t = trees.find(x => x.id === tId);
                           if (t && t.available.food) {
                               t.available.food = false;
                               gs.food += 6 * bonus;
                               queueLog(`${m.name} got apples.`);
                               uiUpdateNeeded = true;
                           }
                      } else if (m.targetResource === 'plants') {
                           const p = plants.find(x => x.id === tId);
                           if (p && p.available) {
                               p.available = false;
                               gs.plants += 3 * bonus;
                               queueLog(`${m.name} got herbs.`);
                               uiUpdateNeeded = true;
                           }
                      }
                  }

                  m.action = 'RETURNING';
                  m.targetPosition = null;
                  m.actionTargetId = null;
                  m.actionTimer = 0;
              }
          }
      });

      // 4. SYNC TO REACT
      setMeeples([...meeplesRef.current]);
      setMobs([...mobsRef.current]);
      
      if (uiUpdateNeeded || Math.random() < 0.05) { 
          setGameState({ ...gs }); 
          setTrees([...treesRef.current]);
          setPlants([...plantsRef.current]);
      }
    });
    return null;
  };

  // --- INTERACTION HANDLERS ---

  const handleMeepleClick = (id: number) => {
    if (selectedId === id) {
        setSelectedId(null);
        setPendingAction(null);
        return;
    }
    const meeple = meeplesRef.current.find(m => m.id === id);
    if (meeple && meeple.action !== 'IDLE' && meeple.stunTimer <= 0) {
        queueLog(`Wait! ${meeple.name} is busy.`);
        setGameState({ ...gameStateRef.current }); 
        return;
    }
    setSelectedId(id);
    setPendingAction(null);
  };

  const onActionClick = (actionName: string) => {
    if (!selectedId) return;
    const m = meeplesRef.current.find(me => me.id === selectedId);
    if (!m) return;
    if (m.stunTimer > 0) { queueLog("Unit is stunned!"); return; }
    if (m.action !== 'IDLE') return; 

    const gs = gameStateRef.current;

    if (actionName === 'EAT') {
        if (gs.food >= 2) {
            gs.food -= 2;
            m.action = 'EATING';
            m.status = 'Fit';
            queueLog("Ate food.");
            setTimeout(() => { m.action = 'IDLE'; setMeeples([...meeplesRef.current]); }, 2000);
        } else queueLog("Not enough food.");
    }
    else if (actionName === 'SLEEP') {
        m.action = 'SLEEPING';
        if (m.status === 'Tired') m.status = gs.fireTimeLeft > 0 ? 'Fit' : 'Normal';
        else if (m.status === 'Normal' && gs.fireTimeLeft > 0) m.status = 'Fit';
        queueLog("Sleeping...");
        setTimeout(() => { m.action = 'IDLE'; setMeeples([...meeplesRef.current]); }, 5000);
    }
    else if (actionName === 'HEAL') {
        if (gs.plants >= 1) {
            gs.plants -= 1;
            m.action = 'HEALING';
            m.status = 'Normal';
            queueLog("Healed.");
            setTimeout(() => { m.action = 'IDLE'; setMeeples([...meeplesRef.current]); }, 2000);
        } else queueLog("Need herbs.");
    }
    else if (actionName === 'RITUAL') {
        m.action = 'RITUAL';
        m.status = 'Normal';
        queueLog("Ritual started.");
        setTimeout(() => { m.action = 'IDLE'; setMeeples([...meeplesRef.current]); }, 3000);
    }
    else if (actionName === 'LIGHT_FIRE') {
        if (gs.wood >= 5) {
            gs.wood -= 5;
            m.action = 'MOVING';
            m.targetPosition = [0, 0, 0];
            m.actionTargetId = -999;
            m.actionTimer = 0;
            queueLog("Moving to fire...");
        } else queueLog("Need 5 wood.");
    }
    else if (actionName === 'GATHER') {
        if (m.status === 'Tired') {
            queueLog("Too tired.");
        } else {
            setPendingAction('GATHER');
            queueLog("Select resource.");
        }
    }

    setGameState({ ...gs });
    setMeeples([...meeplesRef.current]);
  };

  const onNodeClick = (id: number, type: ResourceType, position: [number, number, number]) => {
    if (!position || position.length !== 3 || position.some(v => isNaN(v) || v === null || v === undefined)) {
        return;
    }

    if (selectedId && pendingAction === 'GATHER') {
        const m = meeplesRef.current.find(me => me.id === selectedId);
        if (m) {
            if (m.stunTimer > 0) return;
            m.action = 'MOVING';
            m.targetPosition = [Number(position[0]), Number(position[1]), Number(position[2])];
            m.actionTargetId = id;
            m.targetResource = type;
            m.actionTimer = 0;
            setPendingAction(null);
            setMeeples([...meeplesRef.current]); 
        }
    }
  };

  const selectedMeeple = meeples.find(m => m.id === selectedId);
  const isBusy = selectedMeeple && selectedMeeple.action !== 'IDLE';
  const isStunned = selectedMeeple && selectedMeeple.stunTimer > 0;

  return (
    <div className="relative w-full h-full font-mono text-white">
      <Canvas shadows camera={{ position: [8, 8, 8], fov: 40 }}>
        <Environment 
            gameHour={gameState.hour} 
            trees={trees} 
            plants={plants}
            onNodeClick={onNodeClick} 
            isGathering={pendingAction === 'GATHER'}
        />
        
        <Bonfire timeLeft={gameState.fireTimeLeft} />

        {meeples.map(m => (
            <Meeple 
                key={m.id} 
                data={m} 
                isSelected={selectedId === m.id} 
                onClick={() => handleMeepleClick(m.id)} 
            />
        ))}

        {mobs.map(m => (
            <Mob key={m.id} data={m} />
        ))}

        <OrbitControls maxPolarAngle={Math.PI / 2.2} minDistance={5} maxDistance={40} />
        <GameLoop />
      </Canvas>

      {/* TOP HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="bg-black/50 p-2 rounded backdrop-blur-sm flex gap-4">
            <div className="text-center">
                <div className="text-xs text-gray-400">Day</div>
                <div className="text-xl font-bold">{gameState.day}</div>
            </div>
        </div>

        <div className="bg-black/50 p-2 rounded backdrop-blur-sm flex gap-6">
             <div className="flex flex-col items-center">
                <span className="text-amber-600 font-bold">Wood</span>
                <span>{gameState.wood}</span>
             </div>
             <div className="flex flex-col items-center">
                <span className="text-red-500 font-bold">Food</span>
                <span>{gameState.food}</span>
             </div>
             <div className="flex flex-col items-center">
                <span className="text-purple-400 font-bold">Herbs</span>
                <span>{gameState.plants}</span>
             </div>
             <div className="flex flex-col items-center ml-4 border-l border-gray-600 pl-4">
                <span className="text-orange-500 font-bold">Fire</span>
                <span>{Math.floor(gameState.fireTimeLeft)}h</span>
             </div>
        </div>
      </div>

      {/* LOGS */}
      <div className="absolute top-24 left-4 w-64 pointer-events-none">
         {gameState.logs.map((log, i) => (
             <div key={i} className="text-xs bg-black/40 p-1 mb-1 rounded text-gray-300 backdrop-blur-sm animate-pulse">
                 {log}
             </div>
         ))}
      </div>

      {/* BOTTOM CONTROL PANEL */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-stone-800 p-4 rounded-xl border-2 border-stone-600 flex gap-4 shadow-xl">
        {selectedMeeple ? (
            <>
                <div className="w-1/3 border-r border-stone-600 pr-4">
                    <h2 className="text-xl font-bold text-amber-100">{selectedMeeple.name}</h2>
                    <p className="text-sm text-stone-400">{selectedMeeple.role}</p>
                    <div className={`mt-2 text-sm font-bold px-2 py-1 rounded inline-block
                        ${selectedMeeple.status === 'Fit' ? 'bg-green-800 text-green-200' : 
                          selectedMeeple.status === 'Wounded' ? 'bg-red-800 text-red-200' :
                          selectedMeeple.status === 'Infected' ? 'bg-lime-900 text-lime-400' : 'bg-gray-700'}`}>
                        {selectedMeeple.status}
                    </div>
                    {isStunned ? (
                        <div className="mt-2 text-xs font-bold text-red-400 animate-bounce">
                            💫 STUNNED!
                        </div>
                    ) : isBusy && (
                        <div className="mt-2 text-xs font-bold text-yellow-400 animate-pulse">
                            BUSY - WAIT FOR RETURN
                        </div>
                    )}
                    <p className="text-xs mt-1 text-stone-500">Action: {selectedMeeple.action}</p>
                </div>

                <div className="w-2/3 grid grid-cols-3 gap-2">
                    <button 
                        className={`${UI_BUTTON_CLASS} ${pendingAction === 'GATHER' ? 'bg-stone-500 border-amber-400' : ''}`} 
                        onClick={() => onActionClick('GATHER')}
                        disabled={isBusy || isStunned || selectedMeeple.status === 'Tired'}
                    >
                        ⛏️ Gather {selectedMeeple.status === 'Tired' ? '(Tired)' : ''}
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('LIGHT_FIRE')} disabled={isBusy || isStunned}>
                        🔥 Light Fire (5W)
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('SLEEP')} disabled={isBusy || isStunned}>
                        💤 Sleep
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('EAT')} disabled={isBusy || isStunned}>
                        🍖 Eat (2F)
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('HEAL')} disabled={isBusy || isStunned}>
                        💊 Heal (1P)
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('RITUAL')} disabled={isBusy || isStunned}>
                        ✨ Ritual
                    </button>
                </div>
            </>
        ) : (
            <div className="w-full text-center text-stone-500 italic py-4">
                Select a character to give orders.
            </div>
        )}
      </div>
    </div>
  );
}