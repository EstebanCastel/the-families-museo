"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  PointerLockControls,
  useTexture,
  Text,
  SpotLight,
  MeshReflectorMaterial,
  Environment,
  Lightformer,
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  BakeShadows,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { exhibits, wallArt, sculptures, type Exhibit, type Sculpture as SculptureT } from "@/lib/products";

const H = 6;
const T = 0.4;
const WHITE = "#e9e6df";
const WHITE_HI = "#f3f1ec";
const RED = "#9c2820";
const TRIM = "#2a2622";
const MARBLE = "#e7e3da";
const FOG = "#e3e0d8";

/* ─────────── Texturas procedurales ─────────── */
type Tex = { plaster: THREE.Texture; bump: THREE.Texture; floor: THREE.Texture; rug: THREE.Texture };
let _TEX: Tex | null = null;
function paint(base: string, patch: number, grain: number, seams: boolean, size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d")!; x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 50; i++) {
    const r = 16 + Math.random() * size * 0.24, gx = Math.random() * size, gy = Math.random() * size;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const tone = Math.random() < 0.5 ? "255,255,255" : "0,0,0";
    g.addColorStop(0, `rgba(${tone},${Math.random() * patch})`); g.addColorStop(1, `rgba(${tone},0)`);
    x.fillStyle = g; x.fillRect(gx - r, gy - r, 2 * r, 2 * r);
  }
  if (seams) { x.strokeStyle = "rgba(0,0,0,0.06)"; x.lineWidth = 2; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo((i * size) / 4, 0); x.lineTo((i * size) / 4, size); x.stroke(); x.beginPath(); x.moveTo(0, (i * size) / 4); x.lineTo(size, (i * size) / 4); x.stroke(); } }
  const img = x.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * grain; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function paintRug(): THREE.CanvasTexture {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s; const x = c.getContext("2d")!;
  x.fillStyle = "#8f2018"; x.fillRect(0, 0, s, s);
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  x.strokeStyle = "rgba(240,225,205,0.4)"; x.lineWidth = 4; [16, 28, 42].forEach((m) => x.strokeRect(m, m, s - 2 * m, s - 2 * m));
  x.strokeStyle = "rgba(30,8,6,0.5)"; x.lineWidth = 2; x.strokeRect(22, 22, s - 44, s - 44);
  x.strokeStyle = "rgba(240,225,205,0.32)"; x.lineWidth = 2; x.beginPath(); x.moveTo(s / 2, s / 2 - 38); x.lineTo(s / 2 + 38, s / 2); x.lineTo(s / 2, s / 2 + 38); x.lineTo(s / 2 - 38, s / 2); x.closePath(); x.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function textures(): Tex {
  if (_TEX) return _TEX;
  const plaster = paint("#e8e4db", 0.10, 12, true);
  const bump = paint("#808080", 0.4, 30, true, 256);
  const floor = paint("#d6d2c8", 0.16, 10, false, 256);
  plaster.repeat.set(2, 1.3); bump.repeat.set(2, 1.3); floor.repeat.set(7, 7);
  _TEX = { plaster, bump, floor, rug: paintRug() };
  return _TEX;
}

/* ─────────── Muros y colisiones ─────────── */
type Seg = [number, number, number, number];
const WALLS: Seg[] = [
  [-8, 0, 8, 0], [-8, -22, -2, -22], [2, -22, 8, -22],
  [-8, 0, -8, -9], [-8, -13, -8, -22], [8, 0, 8, -9], [8, -13, 8, -22],
  [-20, -4, -20, -18], [-20, -4, -8, -4], [-20, -18, -8, -18],
  [20, -4, 20, -18], [8, -4, 20, -4], [8, -18, 20, -18],
  [-8, -34, 8, -34], [-8, -22, -8, -34], [8, -22, 8, -34],
];
const isRed = (s: Seg) => (s[1] === -34 && s[3] === -34) || (s[1] === 0 && s[3] === 0);
const COLUMNS: [number, number][] = [[-6, -8], [6, -8], [-6, -16], [6, -16]];
const PLANTS: [number, number][] = [[-7, -2], [7, -2], [-7, -20.5], [7, -20.5], [-18.5, -5.5], [18.5, -16.5]];

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const COLLIDERS: Box[] = [
  ...WALLS.map(([x1, z1, x2, z2]): Box => {
    const v = x1 === x2;
    return v ? { minX: x1 - T / 2, maxX: x1 + T / 2, minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) }
             : { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: z1 - T / 2, maxZ: z1 + T / 2 };
  }),
  ...COLUMNS.map(([x, z]): Box => ({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45 })),
  ...exhibits.map((e): Box => { const [x, z] = e.position; const h = e.hero ? 1.2 : 0.95; return { minX: x - h, maxX: x + h, minZ: z - h, maxZ: z + h }; }),
  ...sculptures.map((s): Box => ({ minX: s.pos[0] - 0.85, maxX: s.pos[0] + 0.85, minZ: s.pos[1] - 0.85, maxZ: s.pos[1] + 0.85 })),
];
function resolveCollisions(pos: THREE.Vector3, r: number) {
  for (const c of COLLIDERS) {
    const cx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX), cz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2), p = r - d; pos.x += (dx / d) * p; pos.z += (dz / d) * p; }
      else { const l = pos.x - c.minX, ri = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z, m = Math.min(l, ri, t, b);
        if (m === l) pos.x = c.minX - r; else if (m === ri) pos.x = c.maxX + r; else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r; }
    }
  }
}
function proximity(pos: THREE.Vector3): Exhibit | null {
  let n: Exhibit | null = null, best = 3.4;
  for (const e of exhibits) { const d = Math.hypot(pos.x - e.position[0], pos.z - e.position[1]); if (d < best) { best = d; n = e; } }
  return n;
}
const WAYPOINTS: [number, number][] = [
  [0, -3.5], [0, -11], [-3.2, -7.5], [3.4, -11.5], [1, -15], [-12.5, -8.5],
  [-15, -13], [14.5, -10.5], [0, -25], [0, -27.5], [5.2, -19],
];

/* ─────────── Navegación ─────────── */
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
  const vel = useRef(new THREE.Vector3()), dir = useRef(new THREE.Vector3()), lastId = useRef<string | null>(null);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05), k = keys.current, speed = k["ShiftLeft"] ? 8 : 4.8;
    const fwd = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const side = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);
    camera.getWorldDirection(dir.current); dir.current.y = 0; dir.current.normalize();
    const right = new THREE.Vector3().crossVectors(dir.current, camera.up).normalize();
    const move = new THREE.Vector3().addScaledVector(dir.current, fwd).addScaledVector(right, side);
    if (move.lengthSq() > 0) move.normalize();
    vel.current.lerp(move.multiplyScalar(speed), 1 - Math.pow(0.0006, d));
    camera.position.addScaledVector(vel.current, d);
    camera.position.y = 1.65; resolveCollisions(camera.position, 0.45);
    const n = proximity(camera.position);
    if ((n?.id ?? null) !== lastId.current) { lastId.current = n?.id ?? null; onActive(n); }
  });
  return null;
}
function TouchNav({ onActive, targetRef }: { onActive: (e: Exhibit | null) => void; targetRef: React.MutableRefObject<THREE.Vector3 | null> }) {
  const { camera, gl } = useThree();
  const yaw = useRef(0), pitch = useRef(0), drag = useRef(false), last = useRef<[number, number]>([0, 0]), lastId = useRef<string | null>(null);
  useEffect(() => {
    camera.rotation.order = "YXZ";
    const el = gl.domElement;
    const down = (e: PointerEvent) => { drag.current = true; last.current = [e.clientX, e.clientY]; };
    const move = (e: PointerEvent) => { if (!drag.current) return; const dx = e.clientX - last.current[0], dy = e.clientY - last.current[1]; last.current = [e.clientX, e.clientY]; yaw.current -= dx * 0.005; pitch.current = THREE.MathUtils.clamp(pitch.current - dy * 0.005, -1.1, 1.1); };
    const up = () => { drag.current = false; };
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [camera, gl]);
  useFrame(() => {
    camera.rotation.set(pitch.current, yaw.current, 0);
    const t = targetRef.current;
    if (t) { const p = camera.position; p.x += (t.x - p.x) * 0.09; p.z += (t.z - p.z) * 0.09; if (Math.hypot(t.x - p.x, t.z - p.z) < 0.08) targetRef.current = null; }
    camera.position.y = 1.65; resolveCollisions(camera.position, 0.45);
    const n = proximity(camera.position);
    if ((n?.id ?? null) !== lastId.current) { lastId.current = n?.id ?? null; onActive(n); }
  });
  return null;
}
function Waypoint({ pos, targetRef }: { pos: [number, number]; targetRef: React.MutableRefObject<THREE.Vector3 | null> }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) { const s = 1 + Math.sin(clock.elapsedTime * 2.5 + pos[0]) * 0.12; ring.current.scale.set(s, s, s); } });
  return (
    <group position={[pos[0], 0.05, pos[1]]} onClick={(e) => { e.stopPropagation(); targetRef.current = new THREE.Vector3(pos[0], 1.65, pos[1]); }}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.34, 0.46, 32]} /><meshBasicMaterial color={RED} transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.3, 24]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.22} toneMapped={false} /></mesh>
    </group>
  );
}

/* ─────────── Arquitectura ─────────── */
function Wall({ seg, mat, redMat }: { seg: Seg; mat: THREE.Material; redMat: THREE.Material }) {
  const [x1, z1, x2, z2] = seg;
  const vert = x1 === x2, len = vert ? Math.abs(z2 - z1) : Math.abs(x2 - x1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  return (
    <group>
      <mesh position={[cx, H / 2, cz]} material={isRed(seg) ? redMat : mat} receiveShadow><boxGeometry args={vert ? [T, H, len] : [len, H, T]} /></mesh>
      <mesh position={[cx, 0.14, cz]}><boxGeometry args={vert ? [T + 0.1, 0.28, len] : [len, 0.28, T + 0.1]} /><meshStandardMaterial color={TRIM} roughness={0.5} metalness={0.1} /></mesh>
      <mesh position={[cx, H - 0.17, cz]}><boxGeometry args={vert ? [T + 0.16, 0.34, len] : [len, 0.34, T + 0.16]} /><meshStandardMaterial color={WHITE_HI} roughness={0.8} /></mesh>
    </group>
  );
}
function DoorFrame({ x, z, w, vert }: { x: number; z: number; w: number; vert?: boolean }) {
  const jamb: [number, number, number] = vert ? [T + 0.18, 3.2, 0.34] : [0.34, 3.2, T + 0.18];
  return (
    <group>
      <mesh position={[x, 4.5, z]}><boxGeometry args={vert ? [T + 0.2, 3, w + 0.4] : [w + 0.4, 3, T + 0.2]} /><meshStandardMaterial color={WHITE_HI} roughness={0.8} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={vert ? [x, 1.6, z + (s * w) / 2] : [x + (s * w) / 2, 1.6, z]}><boxGeometry args={jamb} /><meshStandardMaterial color={WHITE_HI} roughness={0.8} /></mesh>)}
    </group>
  );
}
function Plant({ pos }: { pos: [number, number] }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.35, 0]} castShadow><cylinderGeometry args={[0.28, 0.34, 0.7, 16]} /><meshStandardMaterial color="#1a1714" roughness={0.6} metalness={0.1} /></mesh>
      <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.3, 0.28, 0.08, 16]} /><meshStandardMaterial color="#0d0b09" /></mesh>
      {[[0, 1.2, 0, 0.55], [0.25, 1.45, 0.1, 0.4], [-0.2, 1.4, -0.15, 0.42], [0.1, 1.7, -0.2, 0.32]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} castShadow><icosahedronGeometry args={[p[3], 1]} /><meshStandardMaterial color={i % 2 ? "#2f4029" : "#3a4d32"} roughness={0.9} flatShading /></mesh>
      ))}
    </group>
  );
}
function Rug({ pos, size }: { pos: [number, number]; size: [number, number] }) {
  const tx = textures();
  return <mesh position={[pos[0], 0.02, pos[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={size} /><meshStandardMaterial map={tx.rug} roughness={0.95} metalness={0} /></mesh>;
}
function Floor({ low }: { low: boolean }) {
  const tx = textures();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -17]} receiveShadow>
      <planeGeometry args={[44, 40]} />
      {low ? (
        <meshStandardMaterial map={tx.floor} color="#cfcabf" roughness={0.5} metalness={0.2} />
      ) : (
        <MeshReflectorMaterial resolution={256} mirror={0.3} blur={[300, 90]} mixBlur={1.6} mixStrength={0.9} roughness={0.85} roughnessMap={tx.floor} depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#cfcabf" metalness={0.4} />
      )}
    </mesh>
  );
}
function CeilingLights() {
  // paneles emisivos (sin coste de luz real) que dan lectura de "techo iluminado"
  const spots: [number, number, number, number][] = [
    [-14, -7, 2.2, 1.6], [-14, -15, 2.2, 1.6], [14, -7, 2.2, 1.6], [14, -15, 2.2, 1.6],
    [-4, -11, 1.6, 1.6], [4, -11, 1.6, 1.6],
  ];
  return (
    <group>
      {spots.map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, H - 0.12, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, l]} />
          <meshBasicMaterial color="#fff4e4" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
function Architecture({ low }: { low: boolean }) {
  const tx = textures();
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tx.plaster, bumpMap: tx.bump, bumpScale: 0.05, color: new THREE.Color(WHITE), roughness: 0.95, metalness: 0 }), [tx]);
  const redMat = useMemo(() => new THREE.MeshStandardMaterial({ bumpMap: tx.bump, bumpScale: 0.05, color: new THREE.Color(RED), roughness: 0.85, metalness: 0 }), [tx]);
  const beams: { pos: [number, number, number]; size: [number, number, number] }[] = [];
  for (const z of [-3, -8, -14, -20, -26, -32]) beams.push({ pos: [0, H - 0.25, z], size: [16, 0.45, 0.5] });
  for (const x of [-18, -13, 13, 18]) beams.push({ pos: [x, H - 0.25, -11], size: [0.5, 0.45, 14] });
  return (
    <group>
      <Floor low={low} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, -17]}><planeGeometry args={[44, 40]} /><meshStandardMaterial color="#dedacf" roughness={1} /></mesh>
      {beams.map((b, i) => <mesh key={i} position={b.pos}><boxGeometry args={b.size} /><meshStandardMaterial color="#cbc6bb" roughness={0.9} /></mesh>)}
      <CeilingLights />
      {WALLS.map((s, i) => <Wall key={i} seg={s} mat={wallMat} redMat={redMat} />)}
      <DoorFrame x={0} z={-22} w={4} /><DoorFrame x={-8} z={-11} w={4} vert /><DoorFrame x={8} z={-11} w={4} vert />
      {COLUMNS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, H / 2, 0]} material={wallMat}><boxGeometry args={[0.8, H, 0.8]} /></mesh>
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[1.15, 0.36, 1.15]} /><meshStandardMaterial color={TRIM} roughness={0.5} /></mesh>
          <mesh position={[0, H - 0.18, 0]}><boxGeometry args={[1.15, 0.36, 1.15]} /><meshStandardMaterial color={WHITE_HI} roughness={0.8} /></mesh>
        </group>
      ))}
      {([[3.5, -13], [-3.5, -25], [-17, -7], [17, -16]] as [number, number][]).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.27, 0]} castShadow><boxGeometry args={[1.8, 0.1, 0.7]} /><meshStandardMaterial color={MARBLE} roughness={0.4} metalness={0.05} /></mesh>
          <mesh position={[0, 0.13, 0]}><boxGeometry args={[1.6, 0.28, 0.5]} /><meshStandardMaterial color="#cbc6bb" roughness={0.6} /></mesh>
        </group>
      ))}
      {PLANTS.map((p, i) => <Plant key={i} pos={p} />)}
      <Rug pos={[0, -11]} size={[3.8, 19]} /><Rug pos={[-14, -11]} size={[8, 11]} /><Rug pos={[14, -11]} size={[8, 11]} /><Rug pos={[0, -28]} size={[9.5, 9]} />
    </group>
  );
}
function Skylight({ x, z, shadow }: { x: number; z: number; shadow: boolean }) {
  return (
    <group>
      <mesh position={[x, H - 0.22, z]}><boxGeometry args={[3.4, 0.1, 4.8]} /><meshStandardMaterial color="#bdb8ad" /></mesh>
      <mesh position={[x, H - 0.18, z]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[3, 4.4]} /><meshBasicMaterial color="#fffaf0" toneMapped={false} /></mesh>
      <SpotLight position={[x, H - 0.3, z]} target-position={[x, 0, z]} angle={0.66} penumbra={1} distance={9} intensity={38} color="#fff3e2" attenuation={7} anglePower={3} opacity={0.12} castShadow={shadow} />
    </group>
  );
}
function Artwork({ art }: { art: (typeof wallArt)[number] }) {
  const tex = useTexture(art.img);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }, [tex]);
  return (
    <group position={art.pos} rotation={[0, art.rotY, 0]}>
      <mesh position={[0, 0, -0.02]}><boxGeometry args={[art.w + 0.22, art.h + 0.22, 0.12]} /><meshStandardMaterial color="#0c0c0c" roughness={0.5} metalness={0.2} /></mesh>
      <mesh position={[0, 0, 0.045]}><planeGeometry args={[art.w + 0.06, art.h + 0.06]} /><meshBasicMaterial color="#f6f3ee" toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.05]}><planeGeometry args={[art.w, art.h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <mesh position={[0, art.h / 2 + 0.5, 0.42]}><boxGeometry args={[art.w * 0.7, 0.06, 0.12]} /><meshStandardMaterial color="#1a1a1a" emissive="#ffe6c4" emissiveIntensity={1.6} toneMapped={false} /></mesh>
    </group>
  );
}
function Vitrine({ exhibit, active }: { exhibit: Exhibit; active: boolean }) {
  const tex = useTexture(exhibit.image);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }, [tex]);
  const img = tex.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width ?? 3) / (img?.height ?? 4);
  const ph = exhibit.hero ? 2.7 : 2.0, pw = ph * aspect;
  const baseH = exhibit.hero ? 0.9 : 0.7, baseW = exhibit.hero ? 2.2 : 1.5;
  const glassTop = baseH + ph + 0.3;
  const [x, z] = exhibit.position;
  const rotY = exhibit.hero ? 0 : ((((x * 1.7 + z * 0.9) % 1) + 1) % 1) * 0.7 - 0.35;
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow><boxGeometry args={[baseW, baseH, baseW]} /><meshStandardMaterial color={MARBLE} roughness={0.3} metalness={0.05} /></mesh>
      <mesh position={[0, baseH + 0.01, 0]}><boxGeometry args={[baseW * 0.96, 0.04, baseW * 0.96]} /><meshStandardMaterial color="#15110d" roughness={0.3} metalness={0.3} /></mesh>
      <mesh position={[0, baseH + ph / 2 + 0.1, 0]}><planeGeometry args={[pw, ph]} /><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      {/* foco emisivo del propio vitral (sin luz real) */}
      <mesh position={[0, glassTop + 0.05, 0]}><boxGeometry args={[baseW * 0.5, 0.05, baseW * 0.5]} /><meshBasicMaterial color={active ? "#fff1da" : "#e7ddc9"} toneMapped={false} /></mesh>
      <mesh position={[0, baseH + (glassTop - baseH) / 2, 0]}>
        <boxGeometry args={[baseW * 0.92, glassTop - baseH, baseW * 0.92]} />
        <meshPhysicalMaterial transparent opacity={active ? 0.12 : 0.06} roughness={0.06} metalness={0} transmission={0.5} color="#d6e2e4" depthWrite={false} />
      </mesh>
      <Text position={[0, baseH + 0.2, baseW / 2 + 0.02]} fontSize={0.1} color={active ? "#111" : "#555"} anchorX="center" anchorY="middle" maxWidth={baseW * 0.9} textAlign="center">{exhibit.title.toUpperCase()}</Text>
    </group>
  );
}
function Sculpture({ s }: { s: SculptureT }) {
  const [x, z] = s.pos;
  const marble = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eceae3", roughness: 0.32, metalness: 0.04 }), []);
  const travertine = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ddd6c8", roughness: 0.7, metalness: 0 }), []);
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9a7d4e", roughness: 0.35, metalness: 0.5 }), []);
  const lacquer = useMemo(() => new THREE.MeshStandardMaterial({ color: RED, roughness: 0.18, metalness: 0.1 }), []);
  let form: React.ReactNode = null;
  if (s.type === "monolith") form = <mesh position={[0, 1.7, 0]} rotation={[0, 0.12, 0.05]} material={travertine} castShadow><boxGeometry args={[0.9, 3.4, 0.42]} /></mesh>;
  else if (s.type === "bust") form = (<group>
    <mesh position={[0, 0.5, 0]} material={marble} castShadow><cylinderGeometry args={[0.52, 0.66, 0.95, 24]} /></mesh>
    <mesh position={[0, 1.02, 0]} material={marble} castShadow><cylinderGeometry args={[0.16, 0.22, 0.24, 16]} /></mesh>
    <mesh position={[0, 1.32, 0]} material={marble} castShadow><sphereGeometry args={[0.32, 24, 24]} /></mesh></group>);
  else if (s.type === "knot") form = <mesh position={[0, 1.45, 0]} material={bronze} castShadow><torusKnotGeometry args={[0.55, 0.18, 128, 20]} /></mesh>;
  else if (s.type === "ovoid") form = <mesh position={[0, 1.25, 0]} scale={[1, 1.5, 1]} material={lacquer} castShadow><sphereGeometry args={[0.55, 32, 32]} /></mesh>;
  else if (s.type === "totem") form = (<group>
    <mesh position={[0, 0.45, 0]} material={marble} castShadow><boxGeometry args={[0.85, 0.5, 0.85]} /></mesh>
    <mesh position={[0, 0.9, 0]} material={lacquer} castShadow><cylinderGeometry args={[0.5, 0.5, 0.18, 24]} /></mesh>
    <mesh position={[0, 1.45, 0]} material={marble} castShadow><boxGeometry args={[0.6, 0.9, 0.6]} /></mesh>
    <mesh position={[0, 2.05, 0]} material={bronze} castShadow><sphereGeometry args={[0.34, 24, 24]} /></mesh></group>);
  else form = <mesh position={[0, 1.05, 0]} rotation={[0.3, 0.5, 0.1]} material={travertine} castShadow><dodecahedronGeometry args={[0.85, 0]} /></mesh>;
  return (
    <group position={[x, 0, z]} rotation={[0, s.rotY ?? 0, 0]} scale={s.scale ?? 1}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow><boxGeometry args={[1.3, 0.8, 1.3]} /><meshStandardMaterial color={MARBLE} roughness={0.3} metalness={0.05} /></mesh>
      <mesh position={[0, 0.81, 0]}><boxGeometry args={[1.36, 0.04, 1.36]} /><meshStandardMaterial color="#0f0f0f" roughness={0.3} metalness={0.3} /></mesh>
      <group position={[0, 0.83, 0]}>{form}</group>
      {s.label && <Text position={[0, 1.05, 0.7]} fontSize={0.082} color="#555" anchorX="center" anchorY="middle" maxWidth={1.2} textAlign="center">{s.label.toUpperCase()}</Text>}
    </group>
  );
}
function Signage() {
  return (
    <group>
      <Text position={[0, 3.7, -0.22]} rotation={[0, Math.PI, 0]} fontSize={0.9} color="#f3f1ec" anchorX="center" anchorY="middle" letterSpacing={-0.04}>THE FAMILIES</Text>
      <Text position={[0, 2.85, -0.22]} rotation={[0, Math.PI, 0]} fontSize={0.13} color="#f1d6d2" anchorX="center" anchorY="middle" letterSpacing={0.32}>EL MUSEO · UN ARCHIVO FAMILIAR</Text>
      <Text position={[0, 4.3, -33.78]} fontSize={0.7} color="#f3f1ec" anchorX="center" anchorY="middle" letterSpacing={0.12}>MEMORIA · IDENTIDAD · PERTENENCIA</Text>
      <Text position={[0, 3.4, -21.7]} fontSize={0.16} color="#8a857c" anchorX="center" anchorY="middle" letterSpacing={0.3}>SALA III — EL FONDO</Text>
      <Text position={[-7.78, 3.4, -11]} rotation={[0, Math.PI / 2, 0]} fontSize={0.15} color="#8a857c" anchorX="center" anchorY="middle" letterSpacing={0.3}>SALA II — GALERÍA</Text>
      <Text position={[7.78, 3.4, -11]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.15} color="#8a857c" anchorX="center" anchorY="middle" letterSpacing={0.3}>SALA II — GALERÍA</Text>
    </group>
  );
}
function Intro({ onDone }: { onDone: () => void }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 2.1, -0.6);
    camera.lookAt(0, 1.7, -16);
    const tl = gsap.timeline({ onComplete: onDone });
    tl.to(camera.position, { z: -8, y: 1.65, duration: 3.4, ease: "power2.inOut" });
    return () => { tl.kill(); };
  }, [camera, onDone]);
  return null;
}

function Scene({ onActive, activeId, low }: { onActive: (e: Exhibit | null) => void; activeId: string | null; low: boolean }) {
  const { scene, camera } = useThree();
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const [ready, setReady] = useState(low); // móvil: listo de inmediato; escritorio: tras la intro
  useEffect(() => {
    scene.fog = new THREE.FogExp2(FOG, 0.013);
    scene.background = new THREE.Color(FOG);
    camera.position.set(0, 1.65, -2); camera.lookAt(0, 1.65, -12);
  }, [scene, camera]);
  return (
    <>
      <ambientLight intensity={0.7} color="#eef0f4" />
      <hemisphereLight args={["#ffffff", "#9c9488", 0.7]} />
      <directionalLight position={[6, 11, 4]} intensity={0.55} color="#fff6ec" castShadow={!low} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />

      {/* Iluminación basada en imagen (procedural, sin red) → reflejos realistas */}
      <Environment resolution={128} frames={1} environmentIntensity={0.4}>
        <Lightformer intensity={1.4} position={[0, 7, -12]} rotation={[Math.PI / 2, 0, 0]} scale={[18, 10, 1]} color="#fff4e6" />
        <Lightformer intensity={0.8} position={[0, 4, 8]} scale={[16, 8, 1]} color="#ffffff" />
        <Lightformer intensity={0.5} position={[-16, 4, -11]} rotation={[0, Math.PI / 2, 0]} scale={[10, 6, 1]} color="#ffffff" />
        <Lightformer intensity={0.5} position={[16, 4, -11]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 6, 1]} color="#ffffff" />
      </Environment>

      <Architecture low={low} />
      <Signage />
      <Skylight x={0} z={-7} shadow={false} /><Skylight x={0} z={-15} shadow={false} /><Skylight x={0} z={-29} shadow={false} />
      {sculptures.map((s, i) => <Sculpture key={`s${i}`} s={s} />)}
      <Suspense fallback={null}>
        {wallArt.map((a, i) => <Artwork key={i} art={a} />)}
        {exhibits.map((e) => <Vitrine key={e.id} exhibit={e} active={activeId === e.id} />)}
        <Preload all />
      </Suspense>
      {low ? (
        <>
          <TouchNav onActive={onActive} targetRef={targetRef} />
          {WAYPOINTS.map((w, i) => <Waypoint key={i} pos={w} targetRef={targetRef} />)}
        </>
      ) : (
        <>
          {ready ? (
            <>
              <Player onActive={onActive} />
              <PointerLockControls makeDefault />
            </>
          ) : (
            <Intro onDone={() => setReady(true)} />
          )}
          <EffectComposer multisampling={0}>
            <Bloom luminanceThreshold={0.72} luminanceSmoothing={0.3} intensity={0.55} mipmapBlur radius={0.6} />
            <Vignette offset={0.32} darkness={0.5} eskil={false} />
            <SMAA />
          </EffectComposer>
          <BakeShadows />
        </>
      )}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </>
  );
}
export default function Museum({ onActive, activeId }: { onActive: (e: Exhibit | null) => void; activeId: string | null }) {
  const [low, setLow] = useState(false);
  useEffect(() => { setLow(window.matchMedia("(pointer: coarse)").matches || navigator.hardwareConcurrency <= 4); }, []);
  return (
    <Canvas
      shadows={!low}
      dpr={low ? [1, 1.4] : [1, 1.8]}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
      camera={{ fov: 72, near: 0.1, far: 140 }}
    >
      <Scene onActive={onActive} activeId={activeId} low={low} />
    </Canvas>
  );
}
