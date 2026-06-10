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
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { exhibits, wallArt, type Exhibit } from "@/lib/products";

const H = 6;
const T = 0.4;
const TRIM = "#1a1916";
const STONE_HI = "#bdb9b0";

/* ─────────── Texturas procedurales de concreto ─────────── */
type Tex = { wallMap: THREE.Texture; wallBump: THREE.Texture; floorRough: THREE.Texture };
let _TEX: Tex | null = null;

function paintConcrete(base: string, patch: number, grain: number, seams: boolean): THREE.CanvasTexture {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d")!;
  x.fillStyle = base;
  x.fillRect(0, 0, s, s);
  // manchas suaves (humedad / encofrado)
  for (let i = 0; i < 70; i++) {
    const r = 16 + Math.random() * 130;
    const gx = Math.random() * s;
    const gy = Math.random() * s;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const a = Math.random() * patch;
    const tone = Math.random() < 0.5 ? "255,255,255" : "0,0,0";
    g.addColorStop(0, `rgba(${tone},${a})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    x.fillStyle = g;
    x.fillRect(gx - r, gy - r, 2 * r, 2 * r);
  }
  // juntas de encofrado
  if (seams) {
    x.strokeStyle = "rgba(0,0,0,0.10)";
    x.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      x.beginPath(); x.moveTo((i * s) / 4, 0); x.lineTo((i * s) / 4, s); x.stroke();
      x.beginPath(); x.moveTo(0, (i * s) / 4); x.lineTo(s, (i * s) / 4); x.stroke();
    }
    // perforaciones de tensores
    x.fillStyle = "rgba(0,0,0,0.22)";
    for (let cx = 1; cx < 4; cx++) for (let cy = 1; cy < 4; cy++) {
      x.beginPath(); x.arc((cx * s) / 4, (cy * s) / 4, 3, 0, Math.PI * 2); x.fill();
    }
  }
  // grano fino
  const img = x.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * grain;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function textures(): Tex {
  if (_TEX) return _TEX;
  const wallMap = paintConcrete("#9c998f", 0.16, 20, true);
  const wallBump = paintConcrete("#808080", 0.55, 46, true);
  const floorRough = paintConcrete("#3a3a3c", 0.45, 16, false);
  wallMap.repeat.set(2.5, 1.6);
  wallBump.repeat.set(2.5, 1.6);
  floorRough.repeat.set(7, 7);
  _TEX = { wallMap, wallBump, floorRough };
  return _TEX;
}

/* ─────────── Muros y colisiones ─────────── */
type Seg = [number, number, number, number];
const WALLS: Seg[] = [
  [-8, 0, 8, 0],
  [-8, -22, -2, -22], [2, -22, 8, -22],
  [-8, 0, -8, -9], [-8, -13, -8, -22],
  [8, 0, 8, -9], [8, -13, 8, -22],
  [-20, -4, -20, -18], [-20, -4, -8, -4], [-20, -18, -8, -18],
  [20, -4, 20, -18], [8, -4, 20, -4], [8, -18, 20, -18],
  [-8, -34, 8, -34], [-8, -22, -8, -34], [8, -22, 8, -34],
];
const COLUMNS: [number, number][] = [[-6, -8], [6, -8], [-6, -16], [6, -16]];

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const COLLIDERS: Box[] = [
  ...WALLS.map(([x1, z1, x2, z2]): Box => {
    const v = x1 === x2;
    return v
      ? { minX: x1 - T / 2, maxX: x1 + T / 2, minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) }
      : { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: z1 - T / 2, maxZ: z1 + T / 2 };
  }),
  ...COLUMNS.map(([x, z]): Box => ({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45 })),
];

function resolveCollisions(pos: THREE.Vector3, r: number) {
  for (const c of COLLIDERS) {
    const cx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
    const cz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2), push = r - d;
        pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      } else {
        const l = pos.x - c.minX, ri = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z;
        const m = Math.min(l, ri, t, b);
        if (m === l) pos.x = c.minX - r; else if (m === ri) pos.x = c.maxX + r;
        else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
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
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
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
    const speed = k["ShiftLeft"] ? 8 : 4.8;
    const fwd = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const side = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);
    camera.getWorldDirection(dir.current); dir.current.y = 0; dir.current.normalize();
    const right = new THREE.Vector3().crossVectors(dir.current, camera.up).normalize();
    const move = new THREE.Vector3().addScaledVector(dir.current, fwd).addScaledVector(right, side);
    if (move.lengthSq() > 0) move.normalize();
    vel.current.lerp(move.multiplyScalar(speed), 1 - Math.pow(0.0006, d));
    camera.position.addScaledVector(vel.current, d);
    camera.position.y = 1.65;
    resolveCollisions(camera.position, 0.45);
    let nearest: Exhibit | null = null, best = 3.2;
    for (const e of exhibits) {
      const dist = Math.hypot(camera.position.x - e.position[0], camera.position.z - e.position[1]);
      if (dist < best) { best = dist; nearest = e; }
    }
    if ((nearest?.id ?? null) !== lastId.current) { lastId.current = nearest?.id ?? null; onActive(nearest); }
  });
  return null;
}

/* ─────────── Arquitectura ─────────── */
function Wall({ seg, mat }: { seg: Seg; mat: THREE.Material }) {
  const [x1, z1, x2, z2] = seg;
  const vert = x1 === x2;
  const len = vert ? Math.abs(z2 - z1) : Math.abs(x2 - x1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const wallArgs: [number, number, number] = vert ? [T, H, len] : [len, H, T];
  const baseArgs: [number, number, number] = vert ? [T + 0.1, 0.3, len] : [len, 0.3, T + 0.1];
  const cornArgs: [number, number, number] = vert ? [T + 0.14, 0.4, len] : [len, 0.4, T + 0.14];
  return (
    <group>
      <mesh position={[cx, H / 2, cz]} material={mat} castShadow receiveShadow>
        <boxGeometry args={wallArgs} />
      </mesh>
      <mesh position={[cx, 0.15, cz]} receiveShadow>
        <boxGeometry args={baseArgs} />
        <meshStandardMaterial color={TRIM} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[cx, H - 0.2, cz]}>
        <boxGeometry args={cornArgs} />
        <meshStandardMaterial color={STONE_HI} roughness={0.85} />
      </mesh>
    </group>
  );
}

function DoorFrame({ x, z, w, vert }: { x: number; z: number; w: number; vert?: boolean }) {
  const jamb: [number, number, number] = vert ? [T + 0.16, 3.2, 0.3] : [0.3, 3.2, T + 0.16];
  return (
    <group>
      {/* dintel */}
      <mesh position={[x, 4.5, z]}>
        <boxGeometry args={vert ? [T + 0.18, 3, w + 0.4] : [w + 0.4, 3, T + 0.18]} />
        <meshStandardMaterial color={STONE_HI} roughness={0.85} />
      </mesh>
      {/* jambas */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={vert ? [x, 1.6, z + (s * w) / 2] : [x + (s * w) / 2, 1.6, z]}>
          <boxGeometry args={jamb} />
          <meshStandardMaterial color={STONE_HI} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Architecture() {
  const tx = textures();
  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tx.wallMap, bumpMap: tx.wallBump, bumpScale: 0.08, color: new THREE.Color("#b2afa7"), roughness: 0.96, metalness: 0.02 }),
    [tx]
  );

  // vigas de techo
  const beams: { pos: [number, number, number]; size: [number, number, number] }[] = [];
  for (const z of [-3, -8, -14, -20, -26, -32]) beams.push({ pos: [0, H - 0.25, z], size: [16, 0.5, 0.55] });
  for (const x of [-19, -14, -9]) beams.push({ pos: [x, H - 0.25, -11], size: [0.55, 0.5, 14] });
  for (const x of [9, 14, 19]) beams.push({ pos: [x, H - 0.25, -11], size: [0.55, 0.5, 14] });

  return (
    <group>
      {/* Piso pulido reflectante con variación de aspereza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -17]} receiveShadow>
        <planeGeometry args={[44, 40]} />
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.4}
          blur={[400, 140]}
          mixBlur={1.4}
          mixStrength={1.8}
          roughness={0.9}
          roughnessMap={tx.floorRough}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#232326"
          metalness={0.55}
        />
      </mesh>
      {/* Techo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, -17]}>
        <planeGeometry args={[44, 40]} />
        <meshStandardMaterial color="#121212" roughness={1} />
      </mesh>
      {beams.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color="#171717" roughness={0.9} />
        </mesh>
      ))}

      {WALLS.map((s, i) => <Wall key={i} seg={s} mat={wallMat} />)}

      <DoorFrame x={0} z={-22} w={4} />
      <DoorFrame x={-8} z={-11} w={4} vert />
      <DoorFrame x={8} z={-11} w={4} vert />

      {/* Columnas */}
      {COLUMNS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, H / 2, 0]} material={wallMat} castShadow>
            <boxGeometry args={[0.8, H, 0.8]} />
          </mesh>
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[1.15, 0.36, 1.15]} /><meshStandardMaterial color={TRIM} roughness={0.6} /></mesh>
          <mesh position={[0, H - 0.18, 0]}><boxGeometry args={[1.15, 0.36, 1.15]} /><meshStandardMaterial color={STONE_HI} roughness={0.85} /></mesh>
        </group>
      ))}

      {/* Bancas de galería */}
      {([[0, -11], [0, -27], [-14, -7], [14, -7]] as [number, number][]).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.26, 0]} castShadow><boxGeometry args={[1.8, 0.12, 0.7]} /><meshStandardMaterial color="#15110d" roughness={0.4} metalness={0.1} /></mesh>
          <mesh position={[0, 0.13, 0]}><boxGeometry args={[1.6, 0.26, 0.5]} /><meshStandardMaterial color="#0b0b0b" roughness={0.6} /></mesh>
        </group>
      ))}
    </group>
  );
}

/* ─────────── Claraboyas con haz volumétrico ─────────── */
function Skylight({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <mesh position={[x, H - 0.26, z]}>
        <boxGeometry args={[3.4, 0.1, 4.8]} />
        <meshStandardMaterial color="#0c0c0c" />
      </mesh>
      <mesh position={[x, H - 0.2, z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 4.4]} />
        <meshBasicMaterial color="#fff6ea" toneMapped={false} />
      </mesh>
      <SpotLight position={[x, H - 0.3, z]} target-position={[x, 0, z]} angle={0.64} penumbra={1} distance={9} intensity={48} color="#f6efe3" attenuation={7} anglePower={3} opacity={0.16} />
    </group>
  );
}

/* ─────────── Cuadro de pared con nicho/marco ─────────── */
function Artwork({ art }: { art: (typeof wallArt)[number] }) {
  const tex = useTexture(art.img);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }, [tex]);
  return (
    <group position={art.pos} rotation={[0, art.rotY, 0]}>
      {/* moldura exterior (passe-partout) */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[art.w + 0.5, art.h + 0.5, 0.16]} />
        <meshStandardMaterial color="#cac6bd" roughness={0.8} />
      </mesh>
      {/* marco oscuro */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[art.w + 0.14, art.h + 0.14, 0.1]} />
        <meshStandardMaterial color="#070707" roughness={0.6} metalness={0.25} />
      </mesh>
      {/* fotografía */}
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[art.w, art.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* riel de luz */}
      <mesh position={[0, art.h / 2 + 0.5, 0.42]}>
        <boxGeometry args={[art.w * 0.7, 0.07, 0.14]} />
        <meshStandardMaterial color="#0e0e0e" emissive="#ffe6c4" emissiveIntensity={1.4} toneMapped={false} />
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
  const ph = exhibit.hero ? 2.7 : 2.0;
  const pw = ph * aspect;
  const baseH = exhibit.hero ? 0.9 : 0.7;
  const baseW = exhibit.hero ? 2.2 : 1.5;
  const glassTop = baseH + ph + 0.3;
  const [x, z] = exhibit.position;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[baseW, baseH, baseW]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, baseH + 0.01, 0]}>
        <boxGeometry args={[baseW * 0.96, 0.04, baseW * 0.96]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.25} metalness={0.4} />
      </mesh>
      <mesh position={[0, baseH + ph / 2 + 0.1, 0]}>
        <planeGeometry args={[pw, ph]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, baseH + (glassTop - baseH) / 2, 0]}>
        <boxGeometry args={[baseW * 0.92, glassTop - baseH, baseW * 0.92]} />
        <meshPhysicalMaterial transparent opacity={active ? 0.16 : 0.09} roughness={0.05} metalness={0} transmission={0.6} color="#c2d4d9" depthWrite={false} />
      </mesh>
      <SpotLight position={[0, 5.6, 0.3]} target-position={[0, baseH + ph / 2, 0]} angle={0.42} penumbra={0.85} distance={8} intensity={active ? 70 : 38} color="#fff3e3" attenuation={6} anglePower={5} />
      <Text position={[0, baseH + 0.2, baseW / 2 + 0.02]} fontSize={0.1} color={active ? "#fff" : "#c2bdb4"} anchorX="center" anchorY="middle" maxWidth={baseW * 0.9} textAlign="center">
        {exhibit.title.toUpperCase()}
      </Text>
    </group>
  );
}

function Signage() {
  return (
    <group>
      <Text position={[0, 3.7, -0.22]} rotation={[0, Math.PI, 0]} fontSize={0.9} color="#0e0e0e" anchorX="center" anchorY="middle" letterSpacing={-0.04}>THE FAMILIES</Text>
      <Text position={[0, 2.85, -0.22]} rotation={[0, Math.PI, 0]} fontSize={0.13} color="#a82b22" anchorX="center" anchorY="middle" letterSpacing={0.32}>EL MUSEO · UN ARCHIVO FAMILIAR</Text>
      <Text position={[0, 4.3, -33.78]} fontSize={0.7} color="#13120e" anchorX="center" anchorY="middle" letterSpacing={0.12}>MEMORIA · IDENTIDAD · PERTENENCIA</Text>
      <Text position={[0, 3.4, -21.7]} fontSize={0.16} color="#7e7a71" anchorX="center" anchorY="middle" letterSpacing={0.3}>SALA III — EL FONDO</Text>
      <Text position={[-7.78, 3.4, -11]} rotation={[0, Math.PI / 2, 0]} fontSize={0.15} color="#7e7a71" anchorX="center" anchorY="middle" letterSpacing={0.3}>SALA II — GALERÍA</Text>
      <Text position={[7.78, 3.4, -11]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.15} color="#7e7a71" anchorX="center" anchorY="middle" letterSpacing={0.3}>SALA II — GALERÍA</Text>
    </group>
  );
}

function Scene({ onActive, activeId, isTouch }: { onActive: (e: Exhibit | null) => void; activeId: string | null; isTouch: boolean }) {
  const { scene, camera } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#0a0a0c", 0.024);
    scene.background = new THREE.Color("#0a0a0c");
    camera.position.set(0, 1.65, -1.5);
    camera.lookAt(0, 1.65, -10);
  }, [scene, camera]);
  return (
    <>
      <ambientLight intensity={0.26} color="#c6cad2" />
      <hemisphereLight args={["#dde1e8", "#17170f", 0.38]} />
      <directionalLight position={[6, 11, 4]} intensity={0.32} color="#eef1f6" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
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
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.3} intensity={0.7} mipmapBlur radius={0.7} />
        <Vignette offset={0.28} darkness={0.82} eskil={false} />
        <SMAA />
      </EffectComposer>
      <AdaptiveDpr pixelated />
    </>
  );
}

export default function Museum({ onActive, activeId }: { onActive: (e: Exhibit | null) => void; activeId: string | null }) {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => { setIsTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  return (
    <Canvas shadows dpr={[1, 1.8]} gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ fov: 72, near: 0.1, far: 140 }}>
      <Scene onActive={onActive} activeId={activeId} isTouch={isTouch} />
    </Canvas>
  );
}
