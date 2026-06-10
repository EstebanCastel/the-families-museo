import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "THE FAMILIES — El Museo",
  description:
    "The Families no tiene una tienda. Tiene un museo digital. Un espacio brutalista donde recorres recuerdos y descubres prendas como esculturas.",
  openGraph: {
    title: "THE FAMILIES — El Museo",
    description: "Un museo digital navegable. Memoria, identidad y prendas como esculturas.",
    locale: "es_CO",
    type: "website",
  },
  icons: { icon: "/logo/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}
