import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Trail, Float, Stars, Sky, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
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
    characterId: 'flash' | 'reverse-flash' | 'savitar';
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
        <div 
          className={`h-full rounded-full ${isBoosting ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]' : 'bg-white'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {isBoosting && (
        <div 
          className="text-[9px] text-yellow-400 uppercase font-black tracking-widest mt-1 text-center animate-pulse"
        >
          Supersonic Active
        </div>
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
      newLogs.push('Commands:');
      newLogs.push('  /admin speedforce - Grant admin access');
      newLogs.push('  /admin rich       - Get 10,000 credits');
      newLogs.push('  /admin fast       - Toggle Infinite Speed');
      newLogs.push('  /admin reset      - Reset all progress');
      newLogs.push('  /setscore <val>   - Set specific score');
      newLogs.push('  /clear            - Clear terminal');
      newLogs.push('  /exit             - Close terminal');
    } else if (parts[0] === '/admin') {
      if (parts[1] === 'speedforce') {
        setState(s => ({ ...s, isAdmin: true }));
        newLogs.push('ACCESS GRANTED. Admin privileges enabled.');
      } else if (parts[1] === 'rich') {
        setState(s => ({ ...s, score: s.score + 10000 }));
        newLogs.push('CREDITS ADDED. Balance increased by 10,000.');
      } else if (parts[1] === 'fast') {
        setState(s => ({ ...s, isAdmin: true, isInfiniteSpeed: !s.isInfiniteSpeed }));
        newLogs.push(`INFINITE SPEED ${!state.isInfiniteSpeed ? 'ENABLED' : 'DISABLED'}.`);
      } else if (parts[1] === 'reset') {
        setState(s => ({
          ...s,
          score: 0,
          upgrades: { speed: 0, boostPower: 0, boostDuration: 0 },
          customization: { skinColor: '#e0115f', trailColor: '#ff4400', characterId: 'flash', envPreset: 'city' }
        }));
        newLogs.push('SYSTEM RESET. All progress cleared.');
      } else {
        newLogs.push('ACCESS DENIED. Invalid security code.');
      }
    } else if (parts[0] === '/setscore') {
      const val = parseInt(parts[1]);
      if (!isNaN(val)) {
        setState(s => ({ ...s, score: val }));
        newLogs.push(`SCORE SET TO ${val}.`);
      } else {
        newLogs.push('ERROR: Invalid number.');
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
    <div>
      {state.showAdminConsole && (
        <div
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
        </div>
      )}
    </div>
  );
};

const UpgradeShop = ({ state, setState }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>> }) => {
  const upgradeOptions = [
    { id: 'speed', name: 'Base Speed', icon: <ArrowUp size={18} />, baseCost: 50 },
    { id: 'boostPower', name: 'Boost Power', icon: <Zap size={18} />, baseCost: 75 },
    { id: 'boostDuration', name: 'Boost Time', icon: <RotateCcw size={18} />, baseCost: 100 },
  ];

  const skinOptions = [
    { id: 'flash', name: 'The Flash', color: '#e0115f', trail: '#ffcc00' },
    { id: 'reverse-flash', name: 'Reverse Flash', color: '#ffd700', trail: '#ffcc00' },
    { id: 'savitar', name: 'Savitar', color: '#4a4a4a', trail: '#00ffff' },
    { id: 'flash', name: 'Electric Blue', color: '#00ffff', trail: '#00ffff' },
    { id: 'flash', name: 'Shadow Black', color: '#1a1a1a', trail: '#ffffff' },
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
    <div>
      {state.isShopOpen && (
        <div
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
                        onClick={() => setState(s => ({ 
                          ...s, 
                          customization: { 
                            ...s.customization, 
                            skinColor: skin.color,
                            characterId: (skin as any).id || 'flash',
                            trailColor: (skin as any).trail || s.customization.trailColor
                          } 
                        }))}
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
        </div>
      )}
    </div>
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
      <div
        className="w-12 h-12 rounded-full bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      />
    </div>
  );
};

const LightningBolt = ({ color, position, scale = 1, rotation = [0, 0, 0] }: { color: string, position: [number, number, number], scale?: number, rotation?: [number, number, number] }) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      meshRef.current.visible = Math.random() > 0.4; // More frequent flickering
      meshRef.current.scale.setScalar(scale * (0.7 + Math.random() * 0.6));
      meshRef.current.rotation.y = time * 10; // Spin for more energy
    }
  });

  return (
    <group ref={meshRef} position={position} rotation={rotation}>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.03, 0.6, 0.03]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={10} />
      </mesh>
      <mesh position={[0.1, -0.2, 0]} rotation={[0, 0, -0.8]}>
        <boxGeometry args={[0.03, 0.5, 0.03]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={10} />
      </mesh>
    </group>
  );
};

const FlashModel = ({ color, trailColor, isBoosting, speed, turn, characterId }: { color: string, trailColor: string, isBoosting: boolean, speed: number, turn: number, characterId: GameState['customization']['characterId'] }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const torsoRef = useRef<THREE.Mesh>(null);

  const isSavitar = characterId === 'savitar';
  const isReverse = characterId === 'reverse-flash';

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const runCycle = t * Math.max(speed * 8, 20); 
    const normalizedSpeed = Math.min(speed / 25, 1);
    
    if (groupRef.current) {
      groupRef.current.rotation.x = normalizedSpeed * 0.8;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, -turn * 0.5, 0.1);
    }

    if (speed > 0.1) {
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(runCycle) * 1.3;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(runCycle + Math.PI) * 1.3;
      
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(runCycle + Math.PI) * 1.6;
        leftArmRef.current.rotation.z = 0.1 + Math.sin(runCycle) * 0.15;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = Math.sin(runCycle) * 1.6;
        rightArmRef.current.rotation.z = -0.1 - Math.sin(runCycle) * 0.15;
      }
      if (torsoRef.current) {
        torsoRef.current.position.y = (isSavitar ? 1.0 : 0.8) + Math.sin(runCycle * 2) * 0.06;
        torsoRef.current.rotation.y = Math.sin(runCycle) * 0.15;
      }
    } else {
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = 0;
        leftArmRef.current.rotation.z = 0.1;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = 0;
        rightArmRef.current.rotation.z = -0.1;
      }
      if (torsoRef.current) {
        torsoRef.current.position.y = isSavitar ? 1.0 : 0.8;
        torsoRef.current.rotation.y = 0;
      }
    }
  });

  const eyeColor = isReverse ? "#ff0000" : isSavitar ? "#00ffff" : "#ffffff";
  const emblemColor = isReverse ? "#ff0000" : "#ffd700";

  return (
    <group ref={groupRef} scale={isSavitar ? 1.4 : 1}>
      {/* Torso */}
      <mesh ref={torsoRef} position={[0, isSavitar ? 1.0 : 0.8, 0]} castShadow>
        <boxGeometry args={[isSavitar ? 0.6 : 0.4, isSavitar ? 1.1 : 0.9, isSavitar ? 0.4 : 0.25]} />
        <meshStandardMaterial color={color} roughness={isSavitar ? 0.1 : 0.4} metalness={isSavitar ? 0.8 : 0.2} />
        
        {/* Savitar Armor Spikes */}
        {isSavitar && (
          <>
            <mesh position={[0.35, 0.4, 0]} rotation={[0, 0, -0.5]}>
              <coneGeometry args={[0.05, 0.3, 4]} />
              <meshStandardMaterial color="#888888" metalness={1} />
            </mesh>
            <mesh position={[-0.35, 0.4, 0]} rotation={[0, 0, 0.5]}>
              <coneGeometry args={[0.05, 0.3, 4]} />
              <meshStandardMaterial color="#888888" metalness={1} />
            </mesh>
          </>
        )}

        {/* Belt detail */}
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.42, 0.08, 0.27]} />
          <meshStandardMaterial color={emblemColor} emissive={emblemColor} emissiveIntensity={0.5} />
        </mesh>

        {/* Glowing lines on suit */}
        <mesh position={[0.15, 0, 0.13]}>
          <planeGeometry args={[0.02, 0.8]} />
          <meshStandardMaterial color={emblemColor} emissive={emblemColor} emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[-0.15, 0, 0.13]}>
          <planeGeometry args={[0.02, 0.8]} />
          <meshStandardMaterial color={emblemColor} emissive={emblemColor} emissiveIntensity={1.5} />
        </mesh>
      </mesh>
      
      {/* Head */}
      <mesh position={[0, isSavitar ? 1.7 : 1.4, 0]} castShadow>
        <sphereGeometry args={[isSavitar ? 0.25 : 0.2, 16, 16]} />
        <meshStandardMaterial color={color} metalness={isSavitar ? 0.8 : 0.2} />
        
        {/* Mask Wings */}
        {!isSavitar && (
          <>
            <mesh position={[0.18, 0.05, 0]} rotation={[0, 0, -0.4]}>
              <coneGeometry args={[0.04, 0.15, 4]} />
              <meshStandardMaterial color={emblemColor} />
            </mesh>
            <mesh position={[-0.18, 0.05, 0]} rotation={[0, 0, 0.4]}>
              <coneGeometry args={[0.04, 0.15, 4]} />
              <meshStandardMaterial color={emblemColor} />
            </mesh>
          </>
        )}

        {/* Savitar Head Spikes */}
        {isSavitar && (
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.05, 0.4, 4]} />
            <meshStandardMaterial color="#888888" metalness={1} />
          </mesh>
        )}

        {/* Eyes/Mask detail */}
        <mesh position={[0, 0.05, 0.14]}>
          <boxGeometry args={[0.28, 0.08, 0.08]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2} />
        </mesh>
      </mesh>

      {/* Chest Emblem */}
      <mesh position={[0, isSavitar ? 1.1 : 0.9, 0.14]}>
        <circleGeometry args={[isSavitar ? 0.18 : 0.12, 32]} />
        <meshStandardMaterial color={isReverse ? "#000000" : "#ffffff"} />
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshStandardMaterial color={emblemColor} emissive={emblemColor} emissiveIntensity={1.5} />
        </mesh>
      </mesh>

      {/* Arms */}
      <group position={[isSavitar ? 0.45 : 0.3, isSavitar ? 1.4 : 1.1, 0]}>
        <mesh ref={leftArmRef} position={[0, -0.25, 0]} castShadow>
          <capsuleGeometry args={[isSavitar ? 0.12 : 0.07, isSavitar ? 0.7 : 0.5, 4, 8]} />
          <meshStandardMaterial color={color} metalness={isSavitar ? 0.8 : 0.2} />
          {isSavitar && (
            <mesh position={[0.1, 0, 0]} rotation={[0, 0, -0.5]}>
              <coneGeometry args={[0.04, 0.2, 4]} />
              <meshStandardMaterial color="#888888" metalness={1} />
            </mesh>
          )}
        </mesh>
      </group>
      <group position={[isSavitar ? -0.45 : -0.3, isSavitar ? 1.4 : 1.1, 0]}>
        <mesh ref={rightArmRef} position={[0, -0.25, 0]} castShadow>
          <capsuleGeometry args={[isSavitar ? 0.12 : 0.07, isSavitar ? 0.7 : 0.5, 4, 8]} />
          <meshStandardMaterial color={color} metalness={isSavitar ? 0.8 : 0.2} />
          {isSavitar && (
            <mesh position={[-0.1, 0, 0]} rotation={[0, 0, 0.5]}>
              <coneGeometry args={[0.04, 0.2, 4]} />
              <meshStandardMaterial color="#888888" metalness={1} />
            </mesh>
          )}
        </mesh>
      </group>

      {/* Legs */}
      <group position={[isSavitar ? 0.2 : 0.12, isSavitar ? 0.6 : 0.5, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[isSavitar ? 0.14 : 0.08, isSavitar ? 0.8 : 0.6, 4, 8]} />
          <meshStandardMaterial color={color} metalness={isSavitar ? 0.8 : 0.2} />
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[isSavitar ? 0.25 : 0.18, 0.2, 0.25]} />
            <meshStandardMaterial color={emblemColor} />
          </mesh>
        </mesh>
      </group>
      <group position={[isSavitar ? -0.2 : -0.12, isSavitar ? 0.6 : 0.5, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[isSavitar ? 0.14 : 0.08, isSavitar ? 0.8 : 0.6, 4, 8]} />
          <meshStandardMaterial color={color} metalness={isSavitar ? 0.8 : 0.2} />
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[isSavitar ? 0.25 : 0.18, 0.2, 0.25]} />
            <meshStandardMaterial color={emblemColor} />
          </mesh>
        </mesh>
      </group>

      {/* Lightning Sparks around body - CW style */}
      <group position={[0, 0.8, 0]}>
        {speed > 5 && (
          <>
            <LightningBolt color={trailColor} position={[0.4, 0.2, 0.1]} scale={0.5} />
            <LightningBolt color={trailColor} position={[-0.4, -0.2, -0.1]} scale={0.4} />
            <LightningBolt color={trailColor} position={[0.1, 0.5, 0.2]} scale={0.6} />
            <LightningBolt color={trailColor} position={[-0.2, -0.4, 0.1]} scale={0.5} />
          </>
        )}
        {isBoosting && (
          <>
            <LightningBolt color="#ffffff" position={[0.5, 0.5, 0]} scale={1.2} />
            <LightningBolt color="#ffffff" position={[-0.5, -0.2, 0.2]} scale={1.0} />
            <LightningBolt color="#ffffff" position={[0, 0.8, -0.1]} scale={0.8} />
          </>
        )}
      </group>

      {/* Lightning from back */}
      <group position={[0, 0.8, -0.2]}>
        <LightningBolt color={trailColor} position={[0.2, 0.2, 0]} scale={0.8} />
        <LightningBolt color={trailColor} position={[-0.2, -0.1, 0]} scale={1.2} />
        <LightningBolt color={trailColor} position={[0.1, -0.3, 0]} scale={0.6} />
        {isBoosting && (
          <>
            <LightningBolt color="#ffffff" position={[0.3, 0.4, 0]} scale={1.5} />
            <LightningBolt color="#ffffff" position={[-0.3, 0.1, 0]} scale={1.3} />
          </>
        )}
      </group>
    </group>
  );
};

const Player = ({ state, setState, playerRef, controls }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>>, playerRef: React.RefObject<THREE.Group>, controls: React.MutableRefObject<Controls> }) => {
  const [velocity, setVelocity] = useState(new THREE.Vector3());
  const [currentTurn, setCurrentTurn] = useState(0);
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

    setCurrentTurn(turn);

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
        <group ref={playerRef} position={[0, 0.5, 0]} name="player">
          <FlashModel 
            color={state.customization.skinColor} 
            trailColor={state.customization.trailColor}
            isBoosting={state.isBoosting}
            speed={state.currentSpeed}
            turn={currentTurn}
            characterId={state.customization.characterId}
          />
        </group>
    </group>
  );
};

const FollowCamera = ({ playerRef, speed }: { playerRef: React.RefObject<THREE.Group>, speed: number }) => {
  const { camera } = useThree();
  const offset = new THREE.Vector3(0, 5, -10);

  useFrame(() => {
    if (playerRef.current) {
      const playerPos = playerRef.current.position;
      const idealOffset = offset.clone().applyQuaternion(playerRef.current.quaternion);
      const targetPos = playerPos.clone().add(idealOffset);
      
      camera.position.lerp(targetPos, 0.1);
      camera.lookAt(playerPos);

      // Dynamic FOV based on speed
      const targetFov = 75 + Math.min(speed * 2, 45);
      (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((camera as THREE.PerspectiveCamera).fov, targetFov, 0.05);
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  return null;
};

const World = ({ state, setState, playerRef }: { state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>>, playerRef: React.RefObject<THREE.Group> }) => {
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
  const playerRef = useRef<THREE.Group>(null);
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
      characterId: 'flash',
      envPreset: 'night',
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
        <div> 
          <div
            className="text-4xl font-black italic tracking-tighter uppercase text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"
          >
            Score: {state.score}
          </div>
          <div 
            className="text-xl font-mono text-white/70"
          >
            Time: {state.timer.toFixed(1)}s
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-8 z-10 flex gap-4">
        <button
          onClick={() => setState(s => ({ ...s, showAdminConsole: !s.showAdminConsole }))}
          className="w-12 h-12 bg-black/40 border border-green-500/30 text-green-500 rounded-2xl backdrop-blur-md flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]"
          title="Admin Console"
        >
          <Terminal size={20} />
        </button>

        <button
          onClick={() => setState(s => ({ ...s, isShopOpen: true }))}
          className="px-6 py-3 bg-yellow-400 text-black font-black italic uppercase tracking-tighter rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.3)] flex items-center gap-2"
        >
          <Zap size={18} />
          Upgrades
        </button>
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
          <button
            className="w-20 h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-yellow-400"
            onTouchStart={() => controls.current.jump = true}
            onTouchEnd={() => controls.current.jump = false}
            onMouseDown={() => controls.current.jump = true}
            onMouseUp={() => controls.current.jump = false}
          >
            <ArrowUp size={32} />
          </button>
          <button
            className={`w-20 h-20 rounded-full border backdrop-blur-md flex items-center justify-center transition-colors ${state.isSlowMo ? 'bg-blue-500/40 border-blue-400 text-white' : 'bg-white/10 border-white/20 text-blue-400'}`}
            onTouchStart={() => controls.current.slowMo = true}
            onTouchEnd={() => controls.current.slowMo = false}
            onMouseDown={() => controls.current.slowMo = true}
            onMouseUp={() => controls.current.slowMo = false}
          >
            <Zap size={32} />
          </button>
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
        <ambientLight intensity={state.customization.envPreset === 'night' ? 0.3 : 0.6} />
        <pointLight position={[10, 10, 10]} castShadow intensity={state.customization.envPreset === 'night' ? 0.8 : 1.5} />
        <directionalLight 
          position={[-10, 10, 5]} 
          intensity={state.customization.envPreset === 'night' ? 0.4 : 1} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
        />
        <hemisphereLight intensity={0.5} groundColor="#000000" />
        
        <Player state={state} setState={setState} playerRef={playerRef} controls={controls} />
        <World state={state} setState={setState} playerRef={playerRef} />
        <FollowCamera playerRef={playerRef} speed={state.currentSpeed} />
      </Canvas>
    </div>
  );
}

