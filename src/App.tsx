import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Trail, Float, Stars, Sky, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ArrowUp, Shield, RotateCcw } from 'lucide-react';

// --- Types ---
interface GameState {
  score: number;
  timer: number;
  isBoosting: boolean;
  isSlowMo: boolean;
  gameOver: boolean;
}

interface Controls {
  moveZ: number;
  turn: number;
  jump: boolean;
  slowMo: boolean;
}

// --- Components ---

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

  const SPEED = state.isBoosting ? 60 : 25;
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
  });

  return (
    <group>
      <Trail
        width={state.isBoosting ? 2 : 0.8}
        length={10}
        color={new THREE.Color(state.isBoosting ? "#ffcc00" : "#ff4400")}
        attenuation={(t) => t * t}
      >
        <mesh ref={playerRef} position={[0, 0.5, 0]} castShadow name="player">
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color="#e0115f" emissive="#ff0000" emissiveIntensity={0.5} />
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
  const [rings, setRings] = useState(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    position: [Math.random() * 100 - 50, 1, Math.random() * 200 - 100] as [number, number, number]
  })));

  const [boosts, setBoosts] = useState(() => Array.from({ length: 5 }, (_, i) => ({
    id: i,
    position: [Math.random() * 100 - 50, 0.1, Math.random() * 200 - 100] as [number, number, number]
  })));

  const [enemies, setEnemies] = useState(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    position: [Math.random() * 100 - 50, 0.5, Math.random() * 200 - 100] as [number, number, number]
  })));

  useFrame(() => {
    if (!playerRef.current) return;

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
          setTimeout(() => setState(s => ({ ...s, isBoosting: false })), 5000);
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

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <gridHelper args={[1000, 100, 0x444444, 0x222222]} />

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

      {state.isBoosting && (
        <div className="absolute inset-0 z-0 pointer-events-none border-[20px] border-yellow-400/20 animate-pulse" />
      )}

      {state.isSlowMo && (
        <div className="absolute inset-0 z-0 pointer-events-none bg-blue-900/10 backdrop-blur-[1px]" />
      )}

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
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} castShadow />
        
        <Player state={state} setState={setState} playerRef={playerRef} controls={controls} />
        <World state={state} setState={setState} playerRef={playerRef} />
        <FollowCamera playerRef={playerRef} />
        
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

