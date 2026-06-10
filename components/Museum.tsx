"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  PointerLockControls,
  OrbitControls,
  useTexture,
  Text,
  SpotLight,
  Preload,
  AdaptiveDpr,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { exhibits, HALL_LENGTH, HALL_WIDTH, type Exhibit } from "@/lib/products";

const CONCRETE = "#8d8a84";
const CONCRETE_DARK = "#3a3937";

/* ─────────────────────────── Movimiento FPS ─────────────────────────── */
function useKeys() {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  return keys;
}

function Player({ onActive }: { onActive: (e: Exhibit | null) => void }) {
  const { camera } = useThree();
  const keys = useKeys();
  const vel = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const lastId = useRef<string | null>(null);

  const minX = -HALL_WIDTH / 2 + 0.9;
  const maxX = HALL_WIDTH / 2 - 0.9;
  const minZ = -(HALL_LENGTH - 2);
  const maxZ = 4;

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const speed = 5.2;
    const k = keys.current;
    const fwd = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const side = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);

    camera.getWorldDirection(dir.current);
    dir.current.y = 0;
    dir.current.normalize();
    const right = new THREE.Vector3().crossVectors(dir.current, camera.up).normalize();

    const move = new THREE.Vector3()
      .addScaledVector(dir.current, fwd)
      .addScaledVector(right, side);
    if (move.lengthSq() > 0) move.normalize();

    vel.current.lerp(move.multiplyScalar(speed), 1 - Math.pow(0.0008, d));
    camera.position.addScaledVector(vel.current, d);

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, minX, maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, minZ, maxZ);
    camera.position.y = 1.65;

    // Proximidad a las prendas
    let nearest: Exhibit | null = null;
    let best = 3.4;
    for (const e of exhibits) {
      const dx = camera.position.x - e.position[0];
      const dz = camera.position.z - e.position[1];
      const dist = Math.hypot(dx, dz);
      if (dist < best) {
        best = dist;
        nearest = e;
      }
    }
    if ((nearest?.id ?? null) !== lastId.current) {
      lastId.current = nearest?.id ?? null;
      onActive(nearest);
    }
  });

  return null;
}

/* ─────────────────────────── Arquitectura ─────────────────────────── */
function Architecture() {
  return (
    <group>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -HALL_LENGTH / 2 + 2]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_LENGTH + 10]} />
        <meshStandardMaterial color={CONCRETE_DARK} roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Techo */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6, -HALL_LENGTH / 2 + 2]}>
        <planeGeometry args={[HALL_WIDTH, HALL_LENGTH + 10]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} />
      </mesh>
      {/* Muros laterales */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * HALL_WIDTH) / 2, 3, -HALL_LENGTH / 2 + 2]}>
          <boxGeometry args={[0.4, 6, HALL_LENGTH + 10]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.9} />
        </mesh>
      ))}
      {/* Muro del fondo */}
      <mesh position={[0, 3, -HALL_LENGTH + 2]}>
        <boxGeometry args={[HALL_WIDTH, 6, 0.4]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── Pedestal + prenda ─────────────────────────── */
function Pedestal({ exhibit, active }: { exhibit: Exhibit; active: boolean }) {
  const tex = useTexture(exhibit.image);
  const [x, z] = exhibit.position;
  const facingIn = x < 0 ? 1 : -1; // mira hacia el centro del corredor
  const rotY = x < 0 ? Math.PI / 2 : -Math.PI / 2;

  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex]);

  const img = tex.image as { width?: number; height?: number } | undefined;
  const aspect = (img?.width ?? 3) / (img?.height ?? 4);
  const h = 2.6;
  const w = h * aspect;

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* Base / pedestal */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.6, 1.2, 1.6]} />
        <meshStandardMaterial color="#0e0e0e" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Marco oscuro detrás de la prenda */}
      <mesh position={[0, 2.5, -0.06]}>
        <planeGeometry args={[w + 0.18, h + 0.18]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>
      {/* La prenda */}
      <mesh position={[0, 2.5, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Spot cenital volumétrico */}
      <SpotLight
        position={[0, 5.6, 0.4]}
        target-position={[0, 2.4, 0]}
        angle={0.5}
        penumbra={0.9}
        distance={9}
        intensity={active ? 26 : 14}
        color="#fff6ec"
        attenuation={6}
        anglePower={4}
        castShadow
      />
      {/* Etiqueta */}
      <Text
        position={[0, 0.95, 0.82]}
        fontSize={0.12}
        color={active ? "#ffffff" : "#b9b4ab"}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.5}
        textAlign="center"
        outlineWidth={0}
      >
        {exhibit.title.toUpperCase()}
      </Text>
    </group>
  );
}

/* ─────────────────────────── Texto de entrada ─────────────────────────── */
function HallText() {
  return (
    <group>
      <Text
        position={[0, 3.4, -1.5]}
        fontSize={1.15}
        color="#0c0c0c"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.04}
      >
        THE FAMILIES
      </Text>
      <Text
        position={[0, 2.45, -1.5]}
        fontSize={0.16}
        color="#a82b22"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.34}
      >
        UN ARCHIVO FAMILIAR · SALA II
      </Text>
      <Text
        position={[0, 1, -(HALL_LENGTH - 2.3)]}
        fontSize={0.5}
        color="#1f1e1c"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.2}
      >
        MEMORIA · IDENTIDAD · PERTENENCIA
      </Text>
    </group>
  );
}

/* ─────────────────────────── Escena ─────────────────────────── */
function Scene({ onActive, activeId, isTouch }: { onActive: (e: Exhibit | null) => void; activeId: string | null; isTouch: boolean }) {
  const { scene, camera } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#08080a", 0.045);
    scene.background = new THREE.Color("#08080a");
    camera.position.set(0, 1.65, 3);
  }, [scene, camera]);

  return (
    <>
      <ambientLight intensity={0.25} color="#cfd2da" />
      <directionalLight position={[0, 8, 6]} intensity={0.35} color="#dfe3ea" />
      {/* Claraboya tenue sobre la entrada */}
      <spotLight position={[0, 5.8, 0]} angle={0.8} penumbra={1} intensity={20} distance={14} color="#e8eef6" />

      <Architecture />
      <HallText />
      <Suspense fallback={null}>
        {exhibits.map((e) => (
          <Pedestal key={e.id} exhibit={e} active={activeId === e.id} />
        ))}
        <Preload all />
      </Suspense>

      {isTouch ? (
        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 1.9}
          minDistance={2}
          maxDistance={18}
          target={[0, 1.6, -10]}
        />
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

export default function Museum({
  onActive,
  activeId,
}: {
  onActive: (e: Exhibit | null) => void;
  activeId: string | null;
}) {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 70, near: 0.1, far: 120 }}
    >
      <Scene onActive={onActive} activeId={activeId} isTouch={isTouch} />
    </Canvas>
  );
}
