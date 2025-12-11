import { Vector3 } from 'three';

// --- Colors ---
export const PALETTE = {
  ground: '#1e2f1e', // Dark green
  skyDay: '#87CEEB',
  skyDusk: '#ff9966',
  skyNight: '#2c3e50', // Lighter navy (Nuit Américaine style)
  treeTrunk: '#4a3728',
  treeLeaves: '#2d5a27',
  fire: '#ff5500',
  meepleSkin: '#fcc',
  mob: '#111111',
  mobEyes: '#ff0000',
  fogDay: '#e0f7fa',
  fogNight: '#2c3e50', 
};

// --- Types ---

export type Role = 'Chef' | 'Priestess' | 'Drunkard';

export type Status = 'Fit' | 'Normal' | 'Tired' | 'Wounded' | 'Infected' | 'Dead';

export type ActionType = 'IDLE' | 'MOVING' | 'CHOPPING' | 'GATHERING' | 'MEDICINE' | 'EATING' | 'SLEEPING' | 'HEALING' | 'RITUAL' | 'RETURNING' | 'COMBAT' | 'LIGHTING_FIRE';

export type ResourceType = 'wood' | 'food' | 'plants';

export interface ResourceNode {
  id: number;
  type: 'Tree';
  position: [number, number, number]; // [x, y, z]
  available: {
    wood: boolean;
    food: boolean;
  };
}

export interface PlantNode {
  id: number;
  type: 'Plant';
  position: [number, number, number];
  available: boolean;
}

export interface MobEntity {
  id: number;
  position: [number, number, number];
  angle: number; // Current facing angle
  speed: number;
  state: 'PATROL' | 'WAIT' | 'ATTACK_DASH' | 'FLEEING';
  waitTimer: number; // How long to wait before moving again
  dashTarget: [number, number, number] | null; // Position to dash towards
  targetMeepleId: number | null; // For combat locking
  lastHitTime: number;
}

export interface Meeple {
  id: number;
  name: string;
  role: Role;
  status: Status;
  position: [number, number, number]; // Current visual position
  basePosition: [number, number, number]; // "Home" position (around fire)
  targetPosition: [number, number, number] | null; // Where they are going
  action: ActionType;
  actionTargetId: number | null; // ID of tree or target
  targetResource: ResourceType | null; // Specific resource they are after
  actionTimer: number; // Used for timing actions (gathering, eating) inside the loop
  stunTimer: number; // If > 0, meeple is stunned
  color: string;
  lastHitTime: number;
}

export interface GameState {
  day: number;
  hour: number; // 0-24
  population: number;
  wood: number;
  food: number;
  plants: number;
  fireTimeLeft: number; // Hours remaining
  logs: string[];
}

export const CHAR_SPEED = 3.5;
export const MOB_SPEED = 1.8; // Patrol speed
export const MOB_DASH_SPEED = 8.0; // Attack speed
export const DAY_LENGTH_SECONDS = 240; // Real seconds per game day (Slower time)