"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Exhibit } from "@/lib/products";

const Museum = dynamic(() => import("@/components/Museum"), {
  ssr: false,
  loading: () => null,
});

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Page() {
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState<Exhibit | null>(null);

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-black">
      {entered && <Museum onActive={setActive} activeId={active?.id ?? null} />}

      {/* Pantalla de entrada */}
      <AnimatePresence>
        {!entered && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black px-6 text-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: EASE }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, ease: EASE }}
              className="flex flex-col items-center"
            >
              <Image src="/logo/logo.png" alt="The Families" width={84} height={84} className="mb-10 h-16 w-16" priority />
              <h1 className="display text-[15vw] leading-[0.82] md:text-[8vw]">The Families</h1>
              <p className="kicker mt-6">El Museo — Un archivo familiar</p>
              <p className="mt-8 max-w-sm text-sm leading-relaxed text-[var(--ash)]">
                The Families no tiene una tienda. Tiene un museo. No navegas productos: recorres
                recuerdos. Las prendas aparecen como esculturas en el camino.
              </p>
              <button
                onClick={() => setEntered(true)}
                className="mt-12 border border-[var(--paper)] px-14 py-4 text-[12px] uppercase tracking-[0.4em] transition-colors duration-500 hover:bg-[var(--paper)] hover:text-black"
              >
                Entrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD: indicaciones */}
      {entered && (
        <>
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 md:px-8">
            <span className="kicker text-[var(--paper)]/70">The Families · El Museo</span>
            <span className="kicker hidden text-[var(--paper)]/60 md:inline">
              Sala II — La Colección
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 text-center">
            <p className="kicker text-[var(--paper)]/55">
              <span className="hidden md:inline">Haz clic para mirar · W A S D para caminar · acércate a una prenda</span>
              <span className="md:hidden">Arrastra para mirar el espacio</span>
            </p>
          </div>
          {/* Retícula */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--paper)]/40" />
        </>
      )}

      {/* Ficha de la prenda */}
      <AnimatePresence>
        {entered && active && (
          <motion.aside
            key={active.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="absolute bottom-16 left-1/2 z-20 w-[min(92vw,560px)] -translate-x-1/2 border border-white/12 bg-black/70 p-5 backdrop-blur-md md:bottom-14 md:p-7"
          >
            <div className="flex gap-5">
              <div className="relative hidden h-28 w-24 shrink-0 overflow-hidden bg-white/5 sm:block">
                <Image src={active.image} alt={active.title} fill sizes="96px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="kicker">{active.wing} — {active.category}</p>
                <h2 className="display mt-2 text-2xl md:text-3xl">{active.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--paper)]/70">{active.note}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg text-[var(--paper)]/90">{active.price}</span>
                  <button className="border border-[var(--paper)] px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors duration-400 hover:bg-[var(--paper)] hover:text-black">
                    Añadir al guardarropa
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  );
}
