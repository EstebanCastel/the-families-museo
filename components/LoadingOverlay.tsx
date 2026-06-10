"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

export default function LoadingOverlay() {
  const { progress } = useProgress();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => setHidden(true), 700);
      return () => clearTimeout(t);
    }
  }, [progress]);
  if (hidden) return null;
  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col items-center justify-center bg-black transition-opacity duration-700"
      style={{ opacity: progress >= 100 ? 0 : 1, pointerEvents: progress >= 100 ? "none" : "auto" }}
    >
      <p className="kicker mb-6 text-[var(--paper)]/70">Preparando el museo</p>
      <div className="h-px w-56 overflow-hidden bg-white/20">
        <div className="h-full bg-[var(--paper)] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-4 font-mono text-xs text-[var(--paper)]/60">{Math.round(progress)}%</p>
    </div>
  );
}
