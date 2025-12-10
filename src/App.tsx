import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, SoftShadows } from '@react-three/drei';
import { GameState, Meeple as MeepleType, ResourceNode, PlantNode, MobEntity, CHAR_SPEED, MOB_SPEED, DAY_LENGTH_SECONDS, ResourceType } from './gameData';
import { Bonfire } from './components/Bonfire';
import { Meeple } from './components/Meeple';
import { Mob } from './components/Mob';
import { Environment } from './components/Environment';

// --- Helper Math ---
const distance = (p1: number[], p2: number[]) => Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2);
const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

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
  // Used inside the loop (does not trigger re-render itself, purely state update)
  const queueLog = (msg: string) => {
      gameStateRef.current.logs = [msg, ...gameStateRef.current.logs].slice(0, 5);
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // Init Data
    const initialMeeples: MeepleType[] = [
      { id: 1, name: 'Haldor', role: 'Chef', status: 'Fit', position: [2, 0, 2], basePosition: [2, 0, 2], targetPosition: null, action: 'IDLE', actionTargetId: null, targetResource: null, actionTimer: 0, color: '#4a6fa5', lastHitTime: -999 },
      { id: 2, name: 'Elara', role: 'Priestess', status: 'Normal', position: [-2, 0, 2], basePosition: [-2, 0, 2], targetPosition: null, action: 'IDLE', actionTargetId: null, targetResource: null, actionTimer: 0, color: '#a54a6f', lastHitTime: -999 },
      { id: 3, name: 'Barnaby', role: 'Drunkard', status: 'Tired', position: [0, 0, -3], basePosition: [0, 0, -3], targetPosition: null, action: 'IDLE', actionTargetId: null, targetResource: null, actionTimer: 0, color: '#6fa54a', lastHitTime: -999 },
    ];
    
    const newTrees: ResourceNode[] = [];
    let attempts = 0;
    while(newTrees.length < 25 && attempts < 200) {
      attempts++;
      const x = (Math.random() - 0.5) * 50; 
      const z = (Math.random() - 0.5) * 50;
      if (Math.sqrt(x*x + z*z) < 6) continue;
      if (!newTrees.some(t => distance([x,0,z], t.position) < 4)) {
          newTrees.push({
            id: attempts + 100, type: 'Tree', position: [x, 0, z],
            available: { wood: true, food: Math.random() > 0.4 }
          });
      }
    }

    const newPlants: PlantNode[] = [];
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 20;
        newPlants.push({ id: i + 2000, type: 'Plant', position: [Math.sin(angle) * dist, 0, Math.cos(angle) * dist], available: true });
    }

    const newMobs: MobEntity[] = [];
    for (let i = 0; i < 4; i++) {
      // Changed initial position from 20 to 10 to bring them closer
      newMobs.push({ id: i + 1000, position: [10, 0, 0], angle: (i / 4) * Math.PI * 2, speed: MOB_SPEED, targetMeepleId: null, lastHitTime: -999 });
    }

    // Set Initial Refs AND State
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

      // 2. Mob Logic (Direct Mutation)
      const mobs = mobsRef.current;
      mobs.forEach(mob => {
          mob.angle += mob.speed * 0.1 * safeDelta;
          // Reduced patrol radius from 18 to 8 to ensure they are visible and interact with players
          const patrolRadius = 8; 
          const tx = Math.sin(mob.angle) * patrolRadius;
          const tz = Math.cos(mob.angle) * patrolRadius;
          mob.position[0] = lerp(mob.position[0], tx, safeDelta * 2);
          mob.position[2] = lerp(mob.position[2], tz, safeDelta * 2);
      });

      // 3. Meeple Logic (Direct Mutation)
      const meeples = meeplesRef.current;
      const trees = treesRef.current;
      const plants = plantsRef.current;
      let uiUpdateNeeded = false; // Flag to trigger React render if inventory/logs change

      meeples.forEach(m => {
          // --- Collision Check ---
          const distToHome = distance(m.position, m.basePosition);
          // Invincibility period (0.5s) to prevent spam hits
          const isInvincible = (currentTime - m.lastHitTime) < 0.5;

          // Merge resolved: Use distToHome > 5 (AI Studio version)
          if (distToHome > 5 && m.status !== 'Dead' && !isInvincible) {
              const hitMob = mobs.find(mob => distance(m.position, mob.position) < 1.5);
              if (hitMob) {
                  const isNight = gs.hour < 6 || gs.hour > 20;
                  m.status = (isNight && Math.random() > 0.5) ? 'Infected' : 'Wounded';
                  
                  // Trigger Combat Visuals
                  m.lastHitTime = currentTime;
                  hitMob.lastHitTime = currentTime;

                  queueLog(`⚠️ ${m.name} attacked! (${m.status})`);
                  
                  // Force Return
                  m.action = 'RETURNING';
                  m.targetPosition = null;
                  m.actionTimer = 0;
                  uiUpdateNeeded = true;
              }
          }

          // --- Movement Logic ---
          const isMoving = m.action === 'MOVING' || m.action === 'RETURNING';
          const targetPos = m.action === 'MOVING' ? m.targetPosition : m.action === 'RETURNING' ? m.basePosition : null;

          if (isMoving && targetPos) {
              const d = distance(m.position, targetPos);
              // Larger threshold for non-precise targets
              const threshold = (m.action === 'MOVING' && m.actionTargetId !== -999) ? 1.6 : 0.6;

              if (d < threshold) {
                  // ARRIVED
                  if (m.action === 'RETURNING') {
                      m.action = 'IDLE';
                      m.position = [...m.basePosition]; // Snap home
                  } else {
                      // Arrived at target
                      m.action = m.actionTargetId === -999 ? 'LIGHTING_FIRE' : (m.targetResource === 'wood' ? 'CHOPPING' : 'GATHERING');
                      m.actionTimer = 0;
                  }
              } else {
                  // MOVING
                  let dx = targetPos[0] - m.position[0];
                  let dz = targetPos[2] - m.position[2];
                  const len = Math.sqrt(dx*dx + dz*dz) || 0.001;
                  dx /= len; dz /= len;

                  // Simple Avoidance
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
                  
                  // Re-normalize
                  const flen = Math.sqrt(dx*dx + dz*dz) || 0.001;
                  let speed = CHAR_SPEED * safeDelta * ((m.status === 'Wounded' || m.status === 'Tired') ? 0.6 : 1.0);
                  
                  // Slow down slightly if recently hit and stumbling
                  if (m.action === 'RETURNING' && (m.status === 'Wounded' || m.status === 'Infected') && (currentTime - m.lastHitTime < 1.0)) {
                      speed *= 0.5;
                  }

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
              
              // Wait 1 second then resolve
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

                  // INSTANTLY SWITCH STATE (No waiting for React)
                  m.action = 'RETURNING';
                  m.targetPosition = null;
                  m.actionTargetId = null;
                  m.actionTimer = 0;
              }
          }
      });

      // 4. SYNC TO REACT (End of Frame)
      // This is what makes the game feel "reactive" but runs on stable logic
      // We clone arrays to force React to see the change
      setMeeples([...meeplesRef.current]);
      setMobs([...mobsRef.current]);
      
      // Only sync heavier state if needed
      if (uiUpdateNeeded || Math.random() < 0.05) { // Occasional sync for timers
          setGameState({ ...gs }); // Clone to trigger update
          setTrees([...treesRef.current]);
          setPlants([...plantsRef.current]);
      }
    });
    return null;
  };

  // --- INTERACTION HANDLERS (Modify Refs Directly + Trigger Sync) ---

  const handleMeepleClick = (id: number) => {
    if (selectedId === id) {
        setSelectedId(null);
        setPendingAction(null);
        return;
    }
    const meeple = meeplesRef.current.find(m => m.id === id);
    if (meeple && meeple.action !== 'IDLE') {
        queueLog(`Wait! ${meeple.name} is busy.`);
        setGameState({ ...gameStateRef.current }); // Sync log
        return;
    }
    setSelectedId(id);
    setPendingAction(null);
  };

  const onActionClick = (actionName: string) => {
    if (!selectedId) return;
    const m = meeplesRef.current.find(me => me.id === selectedId);
    if (!m) return;
    if (m.action !== 'IDLE') return; // Double check

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
    // STRICT VALIDATION
    if (!position || position.length !== 3 || position.some(v => isNaN(v) || v === null || v === undefined)) {
        console.error("Invalid position passed to onNodeClick", position);
        return;
    }

    if (selectedId && pendingAction === 'GATHER') {
        const m = meeplesRef.current.find(me => me.id === selectedId);
        if (m) {
            m.action = 'MOVING';
            // Force pure numbers to clean any potential Event reference
            m.targetPosition = [Number(position[0]), Number(position[1]), Number(position[2])];
            m.actionTargetId = id;
            m.targetResource = type;
            m.actionTimer = 0;
            setPendingAction(null);
            setMeeples([...meeplesRef.current]); // Sync
        }
    }
  };

  const selectedMeeple = meeples.find(m => m.id === selectedId);
  const isBusy = selectedMeeple && selectedMeeple.action !== 'IDLE';

  return (
    <div className="relative w-full h-full font-mono text-white">
      <Canvas shadows camera={{ position: [8, 8, 8], fov: 40 }}>
        <SoftShadows size={10} samples={10} />
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
                    {isBusy && (
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
                        disabled={isBusy || selectedMeeple.status === 'Tired'}
                    >
                        ⛏️ Gather {selectedMeeple.status === 'Tired' ? '(Tired)' : ''}
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('LIGHT_FIRE')} disabled={isBusy}>
                        🔥 Light Fire (5W)
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('SLEEP')} disabled={isBusy}>
                        💤 Sleep
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('EAT')} disabled={isBusy}>
                        🍖 Eat (2F)
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('HEAL')} disabled={isBusy}>
                        💊 Heal (1P)
                    </button>
                    <button className={UI_BUTTON_CLASS} onClick={() => onActionClick('RITUAL')} disabled={isBusy}>
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