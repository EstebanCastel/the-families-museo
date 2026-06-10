"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Exhibit } from "@/lib/products";

const Museum = dynamic(() => import("@/components/Museum"), { ssr: false, loading: () => null });

const EASE = [0.16, 1, 0.3, 1] as const;

type CartLine = { id: string; title: string; image: string; unit: number; qty: number };

const priceToNumber = (p: string) => parseInt(p.replace(/[^\d]/g, ""), 10) || 0;
const formatCOP = (n: number) => "$" + n.toLocaleString("es-CO") + " COP";

export default function Page() {
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState<Exhibit | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const activeRef = useRef<Exhibit | null>(null);
  activeRef.current = active;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const addToCart = useCallback(
    (e: Exhibit | null) => {
      if (!e) return;
      setCart((prev) => {
        const found = prev.find((l) => l.id === e.id);
        if (found) return prev.map((l) => (l.id === e.id ? { ...l, qty: l.qty + 1 } : l));
        return [...prev, { id: e.id, title: e.title, image: e.image, unit: priceToNumber(e.price), qty: 1 }];
      });
      showToast(`Añadido: ${e.title}`);
    },
    [showToast]
  );

  const setQty = (id: string, delta: number) =>
    setCart((prev) => prev.flatMap((l) => (l.id === id ? (l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }]) : [l])));

  const openCart = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setCheckout(false);
    setCartOpen(true);
  }, []);

  // Atajos de teclado (funcionan con pointer-lock activo)
  useEffect(() => {
    if (!entered) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === "KeyE") addToCart(activeRef.current);
      else if (ev.code === "KeyB") { ev.preventDefault(); cartOpen ? setCartOpen(false) : openCart(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entered, cartOpen, addToCart, openCart]);

  const count = cart.reduce((s, l) => s + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + l.unit * l.qty, 0);

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-black">
      {entered && <Museum onActive={setActive} activeId={active?.id ?? null} />}

      {/* Pantalla de entrada */}
      <AnimatePresence>
        {!entered && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black px-6 text-center"
            initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease: EASE }}
          >
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4, ease: EASE }} className="flex flex-col items-center">
              <Image src="/logo/logo.png" alt="The Families" width={84} height={84} className="mb-10 h-16 w-16" priority />
              <h1 className="display text-[15vw] leading-[0.82] md:text-[8vw]">The Families</h1>
              <p className="kicker mt-6">El Museo — Un archivo familiar</p>
              <p className="mt-8 max-w-sm text-sm leading-relaxed text-[var(--ash)]">
                The Families no tiene una tienda. Tiene un museo. No navegas productos: recorres recuerdos.
                Las prendas aparecen como esculturas en el camino.
              </p>
              <button onClick={() => setEntered(true)} className="mt-12 border border-[var(--paper)] px-14 py-4 text-[12px] uppercase tracking-[0.4em] transition-colors duration-500 hover:bg-[var(--paper)] hover:text-black">
                Entrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {entered && (
        <>
          {/* Barra superior */}
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 md:px-8">
            <span className="kicker text-[var(--paper)]/70">The Families · El Museo</span>
            <button onClick={openCart} className="pointer-events-auto flex items-center gap-2 border border-white/25 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[var(--paper)] backdrop-blur-sm transition-colors hover:bg-white/10">
              Bolsa
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--blood)] px-1 text-[11px] text-white">{count}</span>
            </button>
          </div>

          {/* Indicaciones */}
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-center">
            <p className="kicker text-[var(--paper)]/55">
              <span className="hidden md:inline">Clic para mirar · WASD caminar · Shift correr · E añadir · B bolsa</span>
              <span className="md:hidden">Arrastra para mirar · toca los círculos del piso para moverte</span>
            </p>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--paper)]/40" />
        </>
      )}

      {/* Ficha de la prenda */}
      <AnimatePresence>
        {entered && active && !cartOpen && (
          <motion.aside
            key={active.id}
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.6, ease: EASE }}
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
                  <button onClick={() => addToCart(active)} className="pointer-events-auto border border-[var(--paper)] px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 hover:bg-[var(--paper)] hover:text-black">
                    Añadir <span className="hidden md:inline opacity-60">· E</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute left-1/2 top-20 z-40 -translate-x-1/2 border border-white/15 bg-black/80 px-5 py-2.5 text-[12px] uppercase tracking-[0.16em] text-[var(--paper)] backdrop-blur">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carrito */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="absolute inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.5, ease: EASE }}
              className="absolute right-0 top-0 z-50 flex h-full w-[min(100vw,420px)] flex-col bg-[var(--paper)] text-black"
            >
              <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
                <h2 className="text-sm uppercase tracking-[0.28em]">Tu bolsa</h2>
                <button onClick={() => setCartOpen(false)} className="text-[12px] uppercase tracking-[0.2em] text-black/60 hover:text-black">Cerrar</button>
              </div>

              {checkout ? (
                <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                  <p className="text-2xl font-semibold">Gracias.</p>
                  <p className="mt-3 text-sm leading-relaxed text-black/60">Recibimos tu pedido por {formatCOP(subtotal)}. Te escribiremos para coordinar la confección a la medida. (Demostración)</p>
                  <button onClick={() => { setCart([]); setCheckout(false); setCartOpen(false); }} className="mt-8 border border-black px-8 py-3 text-[11px] uppercase tracking-[0.2em] hover:bg-black hover:text-[var(--paper)]">Volver al museo</button>
                </div>
              ) : cart.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                  <p className="text-sm text-black/50">Tu bolsa está vacía.</p>
                  <p className="mt-2 text-xs text-black/40">Acércate a una prenda y pulsa E (o el botón Añadir).</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {cart.map((l) => (
                      <div key={l.id} className="flex gap-4 border-b border-black/10 py-4">
                        <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-black/5">
                          <Image src={l.image} alt={l.title} fill sizes="80px" className="object-cover" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <h3 className="text-sm font-medium leading-tight">{l.title}</h3>
                          <span className="mt-1 text-xs text-black/55">{formatCOP(l.unit)}</span>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center border border-black/20">
                              <button onClick={() => setQty(l.id, -1)} className="px-2.5 py-1 text-sm hover:bg-black/5">−</button>
                              <span className="min-w-7 text-center text-sm">{l.qty}</span>
                              <button onClick={() => setQty(l.id, 1)} className="px-2.5 py-1 text-sm hover:bg-black/5">+</button>
                            </div>
                            <span className="text-sm font-medium">{formatCOP(l.unit * l.qty)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-black/10 px-6 py-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="uppercase tracking-[0.2em] text-black/60">Subtotal</span>
                      <span className="text-lg font-semibold">{formatCOP(subtotal)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-black/40">Envíos e impuestos calculados al pagar.</p>
                    <button onClick={() => setCheckout(true)} className="mt-4 w-full bg-black py-4 text-[12px] uppercase tracking-[0.25em] text-[var(--paper)] transition-opacity hover:opacity-85">
                      Ir a pagar
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
