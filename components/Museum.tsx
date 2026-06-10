"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  PointerLockControls,
  OrbitControls,
  useTexture,
  Text,
  SpotLight,
  MeshReflectorMaterial,
  Preload,
  AdaptiveDpr,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { exhibits, wallArt, type Exhibit } from "@/lib/products";

const H = 6; // altura de muro
const T = 0.4; // grosor de muro
const CONCRETE = "#9b9892";
const CONCRETE_HI = "#b4b1aa";
const TRIM = "#1c1b19";

/* ── Muros: [x1,z1,x2,z2] (alineados a ejes) ── */
type Seg = [number, number, number, number];
const WALLS: Seg[] = [
  // Atrio
  [-8, 0, 8, 0], // frontal
  [-8, -22, -2, -22], [2, -22, 8, -22], // fondo (puerta a sala III)
  [-8, 0, -8, -9], [-8, -13, -8, -22], // izq (puerta a galería izq)
  [8, 0, 8, -9], [8, -13, 8, -22], // der (puerta a galería der)
  // Galería izquierda
  [-20, -4, -20, -18], [-20, -4, -8, -4], [-20, -18, -8, -18],
  // Galería derecha
  [20, -4, 20, -18], [8, -4, 20, -4], [8, -18, 20, -18],
  // Sala del fondo
  [-8, -34, 8, -34], [-8, -22, -8, -34], [8, -22, 8, -34],
];

// Columnas del atrio [x,z]
const COLUMNS: [number, number][] = [
  [-6, -8], [6, -8], [-6, -16], [6, -16],
];

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const COLLIDERS: Box[] = [
  ...WALLS.map(([x1, z1, x2, z2]): Box => {
    const vert = x1 === x2;
    return vert
      ? { minX: x1 - T / 2, maxX: x1 + T / 2, minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) }
      : { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: z1 - T / 2, maxZ: z1 + T / 2 };
  }),
  ...COLUMNS.map(([x, z]): Box => ({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 })),
];

function resolveCollisions(pos: THREE.Vector3, r: number) {
  for (const c of COLLIDERS) {
    const cx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
    const cz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = r - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        const l = pos.x - c.minX, ri = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z;
        const m = Math.min(l, ri, t, b);
        if (m === l) pos.x = c.minX - r;
        else if (m === ri) pos.x = c.maxX + r;
        else if (m === t) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      }
    }
  }
}

/* ─────────── Movimiento FPS ─────────── */
function useKeys() {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const d = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, []);
  return keys;
}

function Player({ onActive }: { onActive: (e: Exhibit | null) => void }) {
  const { camera } = useThree();
  const keys = useKeys();
  const vel = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const lastId = useRef<string | null>(null);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const k = keys.current;
    const speed = (k["ShiftLeft"] ? 8 : 4.8);
    const fwd = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const side = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);

    camera.getWorldDirection(dir.current);
    dir.current.y = 0;
    dir.current.normalize();
    const right = new THREE.Vector3().crossVectors(dir.current, camera.up).normalize();
    const move = new THREE.Vector3().addScaledVector(dir.current, fwd).addScaledVector(right, side);
    if (move.lengthSq() > 0) move.normalize();

    vel.current.lerp(move.multiplyScalar(speed), 1 - Math.pow(0.0006, d));
    camera.position.addScaledVector(vel.current, d);
    camera.position.y = 1.65;
    resolveCollisions(camera.position, 0.45);

    let nearest: Exhibit | null = null;
    let best = 3.2;
    for (const e of exhibits) {
      const dist = Math.hypot(camera.position.x - e.position[0], camera.position.z - e.position[1]);
      if (dist < best) { best = dist; nearest = e; }
    }
    if ((nearest?.id ?? null) !== lastId.current) {
      lastId.current = nearest?.id ?? null;
      onActive(nearest);
    }
  });
  return null;
}

/* ─────────── Arquitectura ─────────── */
function Wall({ seg }: { seg: Seg }) {
  const [x1, z1, x2, z2] = seg;
  const vert = x1 === x2;
  const len = vert ? Math.abs(z2 - z1) : Math.abs(x2 - x1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  return (
    <mesh position={[cx, H / 2, cz]} castShadow receiveShadow>
      <boxGeometry args={vert ? [T, H, len] : [len, H, T]} />
      <meshStandardMaterial color={CONCRETE} roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

function Lintel({ x, z, w, vert }: { x: number; z: number; w: number; vert?: boolean }) {
  return (
    <mesh position={[x, 4.5, z]}>
      <boxGeometry args={vert ? [T + 0.1, 3, w] : [w, 3, T + 0.1]} />
      <meshStandardMaterial color={CONCRETE_HI} roughness={0.9} />
    </mesh>
  );
}

function Architecture() {
  return (
    <group>
      {/* Piso pulido reflectante */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -17]} receiveShadow>
        <planeGeometry args={[42, 38]} />
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.45}
          blur={[400, 120]}
          mixBlur={1.2}
          mixStrength={2.2}
          roughness={0.85}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#26262a"
          metalness={0.5}
        />
      </mesh>
      {/* Techo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, -17]}>
        <planeGeometry args={[42, 38]} />
        <meshStandardMaterial color="#141414" roughness={1} />
      </mesh>
      {/* Zócalo oscuro perimetral del atrio */}
      {WALLS.map((s, i) => <Wall key={i} seg={s} />)}

      {/* Linteles sobre las puertas */}
      <Lintel x={0} z={-22} w={4} />{/* a sala del fondo */}
      <Lintel x={-8} z={-11} w={4} vert />{/* a galería izq */}
      <Lintel x={8} z={-11} w={4} vert />{/* a galería der */}

      {/* Columnas del atrio */}
      {COLUMNS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, H / 2, 0]} castShadow>
            <boxGeometry args={[0.7, H, 0.7]} />
            <meshStandardMaterial color={CONCRETE_HI} roughness={0.85} />
          </mesh>
          {/* base y capitel */}
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[1, 0.24, 1]} /><meshStandardMaterial color={TRIM} roughness={0.8} /></mesh>
          <mesh position={[0, H - 0.12, 0]}><boxGeometry args={[1, 0.24, 1]} /><meshStandardMaterial color={TRIM} roughness={0.8} /></mesh>
        </group>
      ))}

      {/* Bancas */}
      {([[0, -11], [0, -27], [-14, -8], [14, -8]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.23, z]} castShadow>
          <boxGeometry args={[1.6, 0.46, 0.6]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.5} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────── Claraboyas con haz volumétrico ─────────── */
function Skylight({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <mesh position={[x, H - 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 4.5]} />
        <meshBasicMaterial color="#fdf7ee" toneMapped={false} />
      </mesh>
      <SpotLight
        position={[x, H - 0.2, z]}
        target-position={[x, 0, z]}
        angle={0.62}
        penumbra={1}
        distance={9}
        intensity={42}
        color="#f5eee2"
        attenuation={7}
        anglePower={3}
        opacity={0.18}
      />
    </group>
  );
}

/* ─────────── Cuadro de pared ─────────── */
function Artwork({ art }: { art: (typeof wallArt)[number] }) {
  const tex = useTexture(art.img);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }, [tex]);
  return (
    <group position={art.pos} rotation={[0, art.rotY, 0]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[art.w + 0.16, art.h + 0.16, 0.08]} />
        <meshStandardMaterial color="#060606" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[art.w, art.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* riel de luz */}
      <mesh position={[0, art.h / 2 + 0.45, 0.35]}>
        <boxGeometry args={[art.w * 0.7, 0.06, 0.12]} />
        <meshStandardMaterial color="#101010" emissive="#ffe9cf" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/* ─────────── Prenda en vitrina ─────────── */
function Vitrine({ exhibit, active }: { exhibit: Exhibit; active: boolean }) {
  const tex = useTexture(exhibit.image);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }, [tex]);
  const img = tex.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width ?? 3) / (img?.height ?? 4);
  const ph = exhibit.hero ? 2.7 : 2.0; // alto de la prenda
  const pw = ph * aspect;
  const baseH = exhibit.hero ? 0.9 : 0.7;
  const baseW = exhibit.hero ? 2.2 : 1.5;
  const glassTop = baseH + ph + 0.3;
  const [x, z] = exhibit.position;

  return (
    <group position={[x, 0, z]}>
      {/* Pedestal */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[baseW, baseH, baseW]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, baseH + 0.01, 0]}>
        <boxGeometry args={[baseW * 0.96, 0.04, baseW * 0.96]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* La prenda (plano luminoso) */}
      <mesh position={[0, baseH + ph / 2 + 0.1, 0]}>
        <planeGeometry args={[pw, ph]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Vitrina de vidrio */}
      <mesh position={[0, baseH + (glassTop - baseH) / 2, 0]}>
        <boxGeometry args={[baseW * 0.92, glassTop - baseH, baseW * 0.92]} />
        <meshPhysicalMaterial
          transparent
          opacity={active ? 0.14 : 0.08}
          roughness={0.05}
          metalness={0}
          transmission={0.6}
          color="#bcd0d6"
          depthWrite={false}
        />
      </mesh>
      {/* Reflector cenital */}
      <SpotLight
        position={[0, 5.6, 0.3]}
        target-position={[0, baseH + ph / 2, 0]}
        angle={0.42}
        penumbra={0.85}
        distance={8}
        intensity={active ? 60 : 34}
        color="#fff4e6"
        attenuation={6}
        anglePower={5}
      />
      {/* Etiqueta de museo */}
      <Text position={[0, baseH + 0.18, baseW / 2 + 0.02]} fontSize={0.1} color={active ? "#fff" : "#bdb8af"} anchorX="center" anchorY="middle" maxWidth={baseW * 0.9} textAlign="center">
        {exhibit.title.toUpperCase()}
      </Text>
    </group>
  );
}

/* ─────────── Rótulos ─────────── */
function Signage() {
  return (
    <group>
      {/* Muro frontal interior: bienvenida */}
      <Text position={[0, 3.7, -0.22]} rotation={[0, Math.PI, 0]} fontSize={0.9} color="#111" anchorX="center" anchorY="middle" letterSpacing={-0.04}>
        THE FAMILIES
      </Text>
      <Text position={[0, 2.85, -0.22]} rotation={[0, Math.PI, 0]} fontSize={0.13} color="#a82b22" anchorX="center" anchorY="middle" letterSpacing={0.32}>
        EL MUSEO · UN ARCHIVO FAMILIAR
      </Text>
      {/* Muro del fondo: lema */}
      <Text position={[0, 4.3, -33.78]} fontSize={0.7} color="#15140f" anchorX="center" anchorY="middle" letterSpacing={0.12}>
        MEMORIA · IDENTIDAD · PERTENENCIA
      </Text>
      {/* Rótulos de sala sobre puertas */}
      <Text position={[0, 3.4, -21.7]} fontSize={0.16} color="#8a857c" anchorX="center" anchorY="middle" letterSpacing={0.3}>
        SALA III — EL FONDO
      </Text>
      <Text position={[-7.78, 3.4, -11]} rotation={[0, Math.PI / 2, 0]} fontSize={0.15} color="#8a857c" anchorX="center" anchorY="middle" letterSpacing={0.3}>
        SALA II — GALERÍA
      </Text>
      <Text position={[7.78, 3.4, -11]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.15} color="#8a857c" anchorX="center" anchorY="middle" letterSpacing={0.3}>
        SALA II — GALERÍA
      </Text>
    </group>
  );
}

/* ─────────── Escena ─────────── */
function Scene({ onActive, activeId, isTouch }: { onActive: (e: Exhibit | null) => void; activeId: string | null; isTouch: boolean }) {
  const { scene, camera } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#0a0a0c", 0.026);
    scene.background = new THREE.Color("#0a0a0c");
    camera.position.set(0, 1.65, -1.5);
    camera.lookAt(0, 1.65, -10);
  }, [scene, camera]);

  return (
    <>
      <ambientLight intensity={0.32} color="#c8ccd4" />
      <hemisphereLight args={["#dfe3ea", "#1a1a18", 0.4]} />
      <directionalLight position={[6, 10, 4]} intensity={0.3} color="#eef1f6" castShadow shadow-mapSize={[1024, 1024]} />

      <Architecture />
      <Signage />
      <Skylight x={0} z={-7} />
      <Skylight x={0} z={-15} />
      <Skylight x={0} z={-29} />

      <Suspense fallback={null}>
        {wallArt.map((a, i) => <Artwork key={i} art={a} />)}
        {exhibits.map((e) => <Vitrine key={e.id} exhibit={e} active={activeId === e.id} />)}
        <Preload all />
      </Suspense>

      {isTouch ? (
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 1.95} minDistance={1} maxDistance={26} target={[0, 1.6, -12]} />
      ) : (
        <>
          <Player onActive={onActive} />
          <PointerLockControls makeDefault />
        </>
      )}
      <AdaptiveDpr pixelated />
    </>
  );
}

export default function Museum({ onActive, activeId }: { onActive: (e: Exhibit | null) => void; activeId: string | null }) {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => { setIsTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  return (
    <Canvas shadows dpr={[1, 1.8]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ fov: 72, near: 0.1, far: 140 }}>
      <Scene onActive={onActive} activeId={activeId} isTouch={isTouch} />
    </Canvas>
  );
}
