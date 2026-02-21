import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Trail, Float, Stars, Sky, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ArrowUp, Shield, RotateCcw, Terminal } from 'lucide-react';

// --- Types ---
interface GameState {
  score: number;
  timer: number;
  isBoosting: boolean;
  isSlowMo: boolean;
  gameOver: boolean;
  currentSpeed: number;
  isShopOpen: boolean;
  activeTab: 'upgrades' | 'custom' | 'admin';
  isAdmin: boolean;
  isInfiniteSpeed: boolean;
  showAdminConsole: boolean;
  upgrades: {
    speed: number;
    boostPower: number;
    boostDuration: number;
  };
  customization: {
    skinColor: string;
    trailColor: string;
    envPreset: 'city' | 'night' | 'sunset' | 'warehouse';
  };
}

interface Controls {
  moveZ: number;
  turn: number;
  jump: boolean;
  slowMo: boolean;
}

// --- Components ---

const Speedometer = ({ speed, isBoosting }: { speed: number, isBoosting: boolean }) => {
  const maxSpeed = 100; // Increased max speed for upgrades
  const percent = Math.min((speed / maxSpeed) * 100, 100);
  
  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 md:left-8 md:translate-x-0 z-10 w-64 px-4 py-3 bg-black/40 border border-white/10 backdrop-blur-md rounded-2xl pointer-events-none">
      <div className="flex justify-between items-end mb-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Velocity</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black italic leading-none transition-colors ${isBoosting ? 'text-yellow-400' : 'text-white'}`}>
            {Math.round(speed * 10)}
          </span>
          <span className="text-xs font-bold text-white/40 uppercase">km/h</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full rounded-full ${isBoosting ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]' : 'bg-white'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        />
      </div>
      {isBoosting && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-[9px] text-yellow-400 uppercase font-black tracking-widest mt-1 text-center"
        >
          Supersonic Active
        </motion.div>
      )}
    </div>
  );
};

const AdminConsole = ({ state, setState }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>> }) => {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>(['System initialized...', 'Type /help for commands']);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim().toLowerCase();
    const parts = cmd.split(' ');
    
    let newLogs = [...logs, `> ${input}`];

    if (cmd === '/help') {
      newLogs.push('Commands: /admin <code>, /clear, /exit');
    } else if (parts[0] === '/admin') {
      if (parts[1] === 'speedforce') {
        setState(s => ({ ...s, isAdmin: true }));
        newLogs.push('ACCESS GRANTED. Admin privileges enabled.');
      } else {
        newLogs.push('ACCESS DENIED. Invalid security code.');
      }
    } else if (cmd === '/clear') {
      newLogs = [];
    } else if (cmd === '/exit') {
      setState(s => ({ ...s, showAdminConsole: false }));
    } else {
      newLogs.push(`Unknown command: ${parts[0]}`);
    }

    setLogs(newLogs);
    setInput('');
  };

  return (
    <AnimatePresence>
      {state.showAdminConsole && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg bg-black/90 border border-green-500/30 backdrop-blur-xl rounded-xl p-4 font-mono text-xs text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
        >
          <div className="flex justify-between items-center mb-2 border-bottom border-green-500/20 pb-2">
            <span className="uppercase tracking-widest font-bold">Admin Terminal v1.0</span>
            <button onClick={() => setState(s => ({ ...s, showAdminConsole: false }))} className="hover:text-white">X</button>
          </div>
          <div className="h-48 overflow-y-auto mb-4 space-y-1 scrollbar-hide">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
          <form onSubmit={handleCommand} className="flex gap-2">
            <span className="text-green-500">$</span>
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              className="flex-1 bg-transparent outline-none border-none text-green-400"
              placeholder="Enter command..."
            />
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const UpgradeShop = ({ state, setState }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>> }) => {
  const upgradeOptions = [
    { id: 'speed', name: 'Base Speed', icon: <ArrowUp size={18} />, baseCost: 50 },
    { id: 'boostPower', name: 'Boost Power', icon: <Zap size={18} />, baseCost: 75 },
    { id: 'boostDuration', name: 'Boost Time', icon: <RotateCcw size={18} />, baseCost: 100 },
  ];

  const skinOptions = [
    { name: 'Classic Red', color: '#e0115f' },
    { name: 'Electric Blue', color: '#00ffff' },
    { name: 'Shadow Black', color: '#1a1a1a' },
    { name: 'Golden Flash', color: '#ffd700' },
    { name: 'Emerald Speed', color: '#50c878' },
  ];

  const trailOptions = [
    { name: 'Red Force', color: '#ff4400' },
    { name: 'Blue Bolt', color: '#0088ff' },
    { name: 'Yellow Flash', color: '#ffcc00' },
    { name: 'Purple Haze', color: '#9d00ff' },
    { name: 'White Light', color: '#ffffff' },
  ];

  const envOptions: { name: string, id: GameState['customization']['envPreset'] }[] = [
    { name: 'City', id: 'city' },
    { name: 'Night', id: 'night' },
    { name: 'Sunset', id: 'sunset' },
    { name: 'Warehouse', id: 'warehouse' },
  ];

  const handleUpgrade = (id: keyof GameState['upgrades']) => {
    const currentLevel = state.upgrades[id];
    const cost = Math.round(upgradeOptions.find(o => o.id === id)!.baseCost * Math.pow(1.5, currentLevel));

    if (state.score >= cost) {
      setState(prev => ({
        ...prev,
        score: prev.score - cost,
        upgrades: {
          ...prev.upgrades,
          [id]: currentLevel + 1
        }
      }));
    }
  };

  return (
    <AnimatePresence>
      {state.isShopOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl"
        >
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-yellow-400">Speed Lab</h2>
                <p className="text-xs text-white/40 uppercase tracking-widest">Customize your speedster</p>
              </div>
              <button 
                onClick={() => setState(s => ({ ...s, isShopOpen: false }))}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <RotateCcw size={20} className="rotate-45" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-2xl">
              <button 
                onClick={() => setState(s => ({ ...s, activeTab: 'upgrades' }))}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${state.activeTab === 'upgrades' ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white'}`}
              >
                Upgrades
              </button>
              <button 
                onClick={() => setState(s => ({ ...s, activeTab: 'custom' }))}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${state.activeTab === 'custom' ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white'}`}
              >
                Custom
              </button>
              {state.isAdmin && (
                <button 
                  onClick={() => setState(s => ({ ...s, activeTab: 'admin' }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${state.activeTab === 'admin' ? 'bg-red-500 text-white' : 'text-red-500/40 hover:text-red-500'}`}
                >
                  Admin
                </button>
              )}
            </div>

            {state.activeTab === 'upgrades' ? (
              <div className="space-y-4 mb-8">
                {upgradeOptions.map(option => {
                  const level = state.upgrades[option.id as keyof GameState['upgrades']];
                  const cost = Math.round(option.baseCost * Math.pow(1.5, level));
                  const canAfford = state.score >= cost;

                  return (
                    <div key={option.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center text-yellow-400">
                          {option.icon}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{option.name}</div>
                          <div className="text-[10px] text-white/40 uppercase font-bold">Level {level}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpgrade(option.id as keyof GameState['upgrades'])}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                          canAfford 
                          ? 'bg-yellow-400 text-black hover:scale-105 active:scale-95' 
                          : 'bg-white/5 text-white/20 cursor-not-allowed'
                        }`}
                      >
                        {cost} pts
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : state.activeTab === 'custom' ? (
              <div className="space-y-6 mb-8">
                {/* Skin Selection */}
                <div>
                  <h3 className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-3">Suit Color</h3>
                  <div className="flex flex-wrap gap-3">
                    {skinOptions.map(skin => (
                      <button
                        key={skin.name}
                        onClick={() => setState(s => ({ ...s, customization: { ...s.customization, skinColor: skin.color } }))}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${state.customization.skinColor === skin.color ? 'border-yellow-400 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: skin.color }}
                        title={skin.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Trail Selection */}
                <div>
                  <h3 className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-3">Lightning Color</h3>
                  <div className="flex flex-wrap gap-3">
                    {trailOptions.map(trail => (
                      <button
                        key={trail.name}
                        onClick={() => setState(s => ({ ...s, customization: { ...s.customization, trailColor: trail.color } }))}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${state.customization.trailColor === trail.color ? 'border-yellow-400 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: trail.color }}
                        title={trail.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Environment Selection */}
                <div>
                  <h3 className="text-[10px] uppercase font-bold text-white/40 tracking-widest mb-3">Environment</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {envOptions.map(env => (
                      <button
                        key={env.id}
                        onClick={() => setState(s => ({ ...s, customization: { ...s.customization, envPreset: env.id } }))}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${state.customization.envPreset === env.id ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400' : 'bg-white/5 border-transparent text-white/40 hover:text-white'}`}
                      >
                        {env.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 mb-8">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <h3 className="text-sm font-bold text-red-500 mb-2">Admin Settings</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70">Infinite Speed</span>
                    <button
                      onClick={() => setState(s => ({ ...s, isInfiniteSpeed: !s.isInfiniteSpeed }))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${state.isInfiniteSpeed ? 'bg-red-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${state.isInfiniteSpeed ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-white/30 mt-2 italic">Warning: Removing speed caps may cause temporal instability.</p>
                </div>
                <button
                  onClick={() => setState(s => ({ ...s, score: s.score + 1000 }))}
                  className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10"
                >
                  Add 1000 Credits
                </button>
              </div>
            )}

            <div className="text-center pt-4 border-t border-white/5">
              <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Available Credits</div>
              <div className="text-3xl font-black italic text-white">{state.score}</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Joystick = ({ onMove }: { onMove: (x: number, y: number) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
  };

  const handleMove = (e: TouchEvent | MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;

    const limitedDistance = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);

    const x = Math.cos(angle) * limitedDistance;
    const y = Math.sin(angle) * limitedDistance;

    setPosition({ x, y });
    onMove(x / maxRadius, -y / maxRadius); // Normalize and invert Y for moveZ
  };

  const handleEnd = () => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="relative w-32 h-32 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center touch-none"
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <motion.div
        className="w-12 h-12 rounded-full bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]"
        animate={{ x: position.x, y: position.y }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      />
    </div>
  );
};

const Player = ({ state, setState, playerRef, controls }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>>, playerRef: React.RefObject<THREE.Mesh>, controls: React.MutableRefObject<Controls> }) => {
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const keys = useRef<{ [key: string]: boolean }>({});

  const BASE_SPEED = state.isInfiniteSpeed ? 500 : 25 + (state.upgrades.speed * 5);
  const BOOST_SPEED = state.isInfiniteSpeed ? 1000 : 60 + (state.upgrades.boostPower * 10);
  const BOOST_DURATION = 5000 + (state.upgrades.boostDuration * 1000);

  const SPEED = state.isBoosting ? BOOST_SPEED : BASE_SPEED;
  const TURN_SPEED = 3;
  const JUMP_FORCE = 8;
  const GRAVITY = 20;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keys.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.code] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!playerRef.current) return;

    // Time scaling for Slow Mo
    const effectiveDelta = state.isSlowMo ? delta * 0.5 : delta;

    // Keyboard Inputs
    const kMoveZ = (keys.current['KeyW'] || keys.current['ArrowUp'] ? 1 : 0) - (keys.current['KeyS'] || keys.current['ArrowDown'] ? 1 : 0);
    const kTurn = (keys.current['KeyA'] || keys.current['ArrowLeft'] ? 1 : 0) - (keys.current['KeyD'] || keys.current['ArrowRight'] ? 1 : 0);
    const kJump = !!keys.current['Space'];
    const kSlowMo = !!keys.current['ShiftLeft'] || !!keys.current['ShiftRight'];

    // Combine Keyboard and Touch
    const moveZ = Math.max(-1, Math.min(1, kMoveZ + controls.current.moveZ));
    const turn = Math.max(-1, Math.min(1, kTurn + controls.current.turn));
    const jump = kJump || controls.current.jump;
    const slowMo = kSlowMo || controls.current.slowMo;

    // Rotation
    playerRef.current.rotation.y += turn * TURN_SPEED * effectiveDelta;

    // Forward movement
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(playerRef.current.quaternion);
    playerRef.current.position.addScaledVector(direction, moveZ * SPEED * effectiveDelta);

    // Jump & Gravity
    if (jump && playerRef.current.position.y <= 0.5) {
      velocity.y = JUMP_FORCE;
    }

    if (playerRef.current.position.y > 0.5 || velocity.y > 0) {
      velocity.y -= GRAVITY * effectiveDelta;
      playerRef.current.position.y += velocity.y * effectiveDelta;
    }

    if (playerRef.current.position.y < 0.5) {
      playerRef.current.position.y = 0.5;
      velocity.y = 0;
    }

    // Slow Mo check
    if (slowMo !== state.isSlowMo) {
      setState(prev => ({ ...prev, isSlowMo: slowMo }));
    }

    // Update Speed State (Throttled for performance)
    const currentSpeed = Math.abs(moveZ * SPEED);
    if (Math.abs(state.currentSpeed - currentSpeed) > 0.5) {
      setState(prev => ({ ...prev, currentSpeed }));
    }
  });

  return (
    <group>
      <Trail
        width={state.isBoosting ? 2 : 0.8}
        length={10}
        color={new THREE.Color(state.isBoosting ? "#ffffff" : state.customization.trailColor)}
        attenuation={(t) => t * t}
      >
        <mesh ref={playerRef} position={[0, 0.5, 0]} castShadow name="player">
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color={state.customization.skinColor} emissive={state.customization.skinColor} emissiveIntensity={0.5} />
        </mesh>
      </Trail>
    </group>
  );
};

const FollowCamera = ({ playerRef }: { playerRef: React.RefObject<THREE.Mesh> }) => {
  const { camera } = useThree();
  const offset = new THREE.Vector3(0, 5, -10);

  useFrame(() => {
    if (playerRef.current) {
      const playerPos = playerRef.current.position;
      const idealOffset = offset.clone().applyQuaternion(playerRef.current.quaternion);
      const targetPos = playerPos.clone().add(idealOffset);
      
      camera.position.lerp(targetPos, 0.1);
      camera.lookAt(playerPos);
    }
  });

  return null;
};

const World = ({ state, setState, playerRef }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>>, playerRef: React.RefObject<THREE.Mesh> }) => {
  const [rings, setRings] = useState<{ id: number, position: [number, number, number] }[]>([]);
  const [boosts, setBoosts] = useState<{ id: number, position: [number, number, number] }[]>([]);
  const [enemies, setEnemies] = useState<{ id: number, position: [number, number, number] }[]>([]);
  
  const lastSpawnZ = useRef(0);
  const nextId = useRef(0);
  const CHUNK_SIZE = 100;
  const SPAWN_AHEAD = 500;
  const CLEANUP_BEHIND = 200;

  // Procedural Spawning
  useFrame(() => {
    if (!playerRef.current) return;
    const playerZ = playerRef.current.position.z;

    // Spawn new chunk if player moved far enough
    if (playerZ + SPAWN_AHEAD > lastSpawnZ.current) {
      const spawnZ = lastSpawnZ.current;
      const newRings = Array.from({ length: 5 }, () => ({
        id: nextId.current++,
        position: [Math.random() * 40 - 20, 1, spawnZ + Math.random() * CHUNK_SIZE] as [number, number, number]
      }));
      const newBoosts = Array.from({ length: 1 }, () => ({
        id: nextId.current++,
        position: [Math.random() * 40 - 20, 0.1, spawnZ + Math.random() * CHUNK_SIZE] as [number, number, number]
      }));
      const newEnemies = Array.from({ length: 2 }, () => ({
        id: nextId.current++,
        position: [Math.random() * 40 - 20, 0.5, spawnZ + Math.random() * CHUNK_SIZE] as [number, number, number]
      }));

      setRings(prev => [...prev, ...newRings]);
      setBoosts(prev => [...prev, ...newBoosts]);
      setEnemies(prev => [...prev, ...newEnemies]);
      lastSpawnZ.current += CHUNK_SIZE;
    }

    // Cleanup old items
    const cleanupThreshold = playerZ - CLEANUP_BEHIND;
    setRings(prev => prev.filter(r => r.position[2] > cleanupThreshold));
    setBoosts(prev => prev.filter(b => b.position[2] > cleanupThreshold));
    setEnemies(prev => prev.filter(e => e.position[2] > cleanupThreshold));

    const playerPos = playerRef.current.position;

    // Ring Collision
    setRings(prev => {
      const next = prev.filter(ring => {
        const dist = playerPos.distanceTo(new THREE.Vector3(...ring.position));
        if (dist < 1.5) {
          setState(s => ({ ...s, score: s.score + 10 }));
          return false;
        }
        return true;
      });
      return next;
    });

    // Boost Collision
    setBoosts(prev => {
      const next = prev.filter(boost => {
        const dist = playerPos.distanceTo(new THREE.Vector3(...boost.position));
        if (dist < 2 && !state.isBoosting) {
          setState(s => ({ ...s, isBoosting: true }));
          const duration = 5000 + (state.upgrades.boostDuration * 1000);
          setTimeout(() => setState(s => ({ ...s, isBoosting: false })), duration);
          return false;
        }
        return true;
      });
      return next;
    });

    // Enemy Collision
    setEnemies(prev => {
      const next = prev.filter(enemy => {
        const dist = playerPos.distanceTo(new THREE.Vector3(...enemy.position));
        if (dist < 1.5) {
          setState(s => ({ ...s, score: s.score + 20 }));
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ff0000', '#ffffff']
          });
          return false;
        }
        return true;
      });
      return next;
    });
  });

  // Tiled Ground following player
  const groundRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groundRef.current && playerRef.current) {
      groundRef.current.position.z = Math.floor(playerRef.current.position.z / 100) * 100;
    }
  });

  return (
    <group>
      {/* Infinite Ground Group */}
      <group ref={groundRef}>
        {/* Main Road Strip */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[40, 1000]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        
        {/* Side Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[2000, 1000]} />
          <meshStandardMaterial color="#050505" />
        </mesh>

        <gridHelper args={[2000, 100, 0x444444, 0x222222]} rotation={[0, 0, 0]} />
        
        {/* Road Markings */}
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh key={i} position={[0, 0.01, (i - 10) * 50]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1, 10]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.2} />
          </mesh>
        ))}
      </group>

      {/* Rings */}
      {rings.map(ring => (
        <Float key={ring.id} speed={2} rotationIntensity={2}>
          <mesh position={ring.position}>
            <torusGeometry args={[0.5, 0.1, 16, 100]} />
            <meshStandardMaterial color="gold" emissive="orange" emissiveIntensity={2} />
          </mesh>
        </Float>
      ))}

      {/* Boost Pads */}
      {boosts.map(boost => (
        <mesh key={boost.id} position={boost.position} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 3]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Enemies */}
      {enemies.map(enemy => (
        <mesh key={enemy.id} position={enemy.position}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      ))}
    </group>
  );
};

export default function App() {
  const playerRef = useRef<THREE.Mesh>(null);
  const [state, setState] = useState<GameState>({
    score: 0,
    timer: 0,
    isBoosting: false,
    isSlowMo: false,
    gameOver: false,
    currentSpeed: 0,
    isShopOpen: false,
    activeTab: 'upgrades',
    isAdmin: false,
    isInfiniteSpeed: false,
    showAdminConsole: false,
    upgrades: {
      speed: 0,
      boostPower: 0,
      boostDuration: 0,
    },
    customization: {
      skinColor: '#e0115f',
      trailColor: '#ff4400',
      envPreset: 'city',
    },
  });

  const controls = useRef<Controls>({
    moveZ: 0,
    turn: 0,
    jump: false,
    slowMo: false,
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        setState(s => ({ ...s, showAdminConsole: !s.showAdminConsole }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(s => ({ ...s, timer: s.timer + 0.1 }));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full font-sans text-white overflow-hidden bg-black select-none">
      {/* UI Overlay */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-black italic tracking-tighter uppercase text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"
        >
          Score: {state.score}
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-mono text-white/70"
        >
          Time: {state.timer.toFixed(1)}s
        </motion.div>
      </div>

      <div className="absolute top-8 right-8 z-10 flex gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setState(s => ({ ...s, showAdminConsole: !s.showAdminConsole }))}
          className="w-12 h-12 bg-black/40 border border-green-500/30 text-green-500 rounded-2xl backdrop-blur-md flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]"
          title="Admin Console"
        >
          <Terminal size={20} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setState(s => ({ ...s, isShopOpen: true }))}
          className="px-6 py-3 bg-yellow-400 text-black font-black italic uppercase tracking-tighter rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.3)] flex items-center gap-2"
        >
          <Zap size={18} />
          Upgrades
        </motion.button>
      </div>

      {state.isBoosting && (
        <div className="absolute inset-0 z-0 pointer-events-none border-[20px] border-yellow-400/20 animate-pulse" />
      )}

      {state.isSlowMo && (
        <div className="absolute inset-0 z-0 pointer-events-none bg-blue-900/10 backdrop-blur-[1px]" />
      )}

      <AdminConsole state={state} setState={setState} />

      <UpgradeShop state={state} setState={setState} />

      <Speedometer speed={state.currentSpeed} isBoosting={state.isBoosting} />

      {/* Desktop Hints */}
      {!isMobile && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none opacity-50">
          <p className="text-xs uppercase tracking-widest">WASD to Move • Space to Jump • Shift for Slow-Mo</p>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Left Side: Joystick */}
          <div className="absolute bottom-12 left-12 pointer-events-auto">
            <Joystick onMove={(x, y) => {
              controls.current.turn = -x;
              controls.current.moveZ = y;
            }} />
          </div>

          {/* Right Side: Action Buttons */}
          <div className="absolute bottom-12 right-12 flex flex-col gap-6 pointer-events-auto">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-20 h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-yellow-400"
              onTouchStart={() => controls.current.jump = true}
              onTouchEnd={() => controls.current.jump = false}
              onMouseDown={() => controls.current.jump = true}
              onMouseUp={() => controls.current.jump = false}
            >
              <ArrowUp size={32} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className={`w-20 h-20 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors ${state.isSlowMo ? 'bg-blue-500/40 border-blue-400 text-white' : 'bg-white/10 border-white/20 text-blue-400'}`}
              onTouchStart={() => controls.current.slowMo = true}
              onTouchEnd={() => controls.current.slowMo = false}
              onMouseDown={() => controls.current.slowMo = true}
              onMouseUp={() => controls.current.slowMo = false}
            >
              <Zap size={32} />
            </motion.button>
          </div>
        </div>
      )}

      {/* Game Scene */}
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 5, -10]} fov={75} />
        {state.customization.envPreset === 'sunset' ? (
          <Sky sunPosition={[100, 2, 100]} />
        ) : state.customization.envPreset === 'night' ? (
          <Sky sunPosition={[100, -20, 100]} />
        ) : (
          <Sky sunPosition={[100, 20, 100]} />
        )}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={state.customization.envPreset === 'night' ? 0.2 : 0.5} />
        <pointLight position={[10, 10, 10]} castShadow intensity={state.customization.envPreset === 'night' ? 0.5 : 1} />
        
        <Player state={state} setState={setState} playerRef={playerRef} controls={controls} />
        <World state={state} setState={setState} playerRef={playerRef} />
        <FollowCamera playerRef={playerRef} />
        
        <Environment preset={state.customization.envPreset} />
      </Canvas>
    </div>
  );
}

