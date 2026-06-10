export type Exhibit = {
  id: string;
  title: string;
  category: string;
  price: string;
  image: string;
  note: string;
  wing: string;
  position: [number, number]; // (x, z) del pedestal dentro del museo
  hero?: boolean;
};

export const exhibits: Exhibit[] = [
  {
    id: "shroud-fur-parka",
    title: "Parka Sudario de Piel",
    category: "Abrigos",
    price: "$1.680.000 COP",
    image: "/looks/look-01.jpg",
    note: "Construida alrededor de una fotografía de la infancia: un abrigo demasiado grande para el cuerpo que lo habitaba.",
    wing: "Sala III · El Fondo",
    position: [0, -29],
    hero: true,
  },
  {
    id: "studded-leather-harness",
    title: "Arnés de Cuero con Tachas",
    category: "Abrigos",
    price: "$990.000 COP",
    image: "/looks/look-15.jpg",
    note: "Armadura para lo blando. Sostiene el cuerpo como un nombre sostiene a una persona.",
    wing: "Sala I · El Atrio",
    position: [-4.8, -5.5],
  },
  {
    id: "fam-23-varsity",
    title: "Varsity Fam 23",
    category: "Tejidos",
    price: "$820.000 COP",
    image: "/looks/look-44.jpg",
    note: "El número veintitrés no pertenecía a ningún equipo. Lo guardamos como una pregunta.",
    wing: "Sala I · El Atrio",
    position: [4.6, -8.5],
  },
  {
    id: "tartan-salvage-denim",
    title: "Denim Tartán Recuperado",
    category: "Pantalones",
    price: "$740.000 COP",
    image: "/looks/look-23.jpg",
    note: "Cada pierna carga una década distinta de denim. El volumen como protección.",
    wing: "Sala II · Galería Izquierda",
    position: [-12.5, -8.5],
  },
  {
    id: "leopard-trapper",
    title: "Máscara Trapper Leopardo",
    category: "Accesorios",
    price: "$450.000 COP",
    image: "/looks/look-34.jpg",
    note: "Un rostro que se niega a ser un rostro. El anonimato es lo más íntimo que hacemos.",
    wing: "Sala II · Galería Derecha",
    position: [14.5, -13.5],
  },
  {
    id: "green-cross-balaclava",
    title: "Balaclava Cruz Verde",
    category: "Accesorios",
    price: "$320.000 COP",
    image: "/looks/look-21.jpg",
    note: "Devoción sin iglesia. Llevamos nuestras preguntas sobre la fe como una familia lleva sus silencios.",
    wing: "Sala I · El Atrio",
    position: [1, -17.5],
  },
];

// Esculturas (arte 3D, no comprables) — dan cuerpo y rompen la simetría del museo.
export type Sculpture = {
  type: "monolith" | "bust" | "knot" | "stone" | "orb";
  pos: [number, number];
  scale?: number;
  rotY?: number;
  light?: boolean;
  label?: string;
};
export const sculptures: Sculpture[] = [
  { type: "monolith", pos: [-1.5, -11.5], scale: 1.05, rotY: 0.5, light: true, label: "Sin título (Familia)" },
  { type: "stone", pos: [5.5, -19], scale: 1, rotY: 0.9 },
  { type: "bust", pos: [-16, -15.5], scale: 1, rotY: -0.5, light: true, label: "Retrato anónimo" },
  { type: "knot", pos: [16.5, -6.5], scale: 1, rotY: 0.3, light: true },
  { type: "orb", pos: [-5, -31], scale: 0.9, rotY: 0 },
  { type: "orb", pos: [5, -31], scale: 0.9, rotY: 1.2 },
];

// Cuadros (fotografías de archivo) colgados en los muros — ambientales, no comprables.
export const wallArt: { img: string; pos: [number, number, number]; rotY: number; w: number; h: number }[] = [
  // Galería izquierda — muro x=-20 (mira +x)
  { img: "/looks/look-03.jpg", pos: [-19.7, 2.3, -7], rotY: Math.PI / 2, w: 1.6, h: 2.0 },
  { img: "/looks/look-05.jpg", pos: [-19.7, 2.3, -11], rotY: Math.PI / 2, w: 1.6, h: 2.0 },
  { img: "/looks/look-07.jpg", pos: [-19.7, 2.3, -15], rotY: Math.PI / 2, w: 1.6, h: 2.0 },
  // Galería derecha — muro x=20 (mira -x)
  { img: "/looks/look-12.jpg", pos: [19.7, 2.3, -7], rotY: -Math.PI / 2, w: 1.6, h: 2.0 },
  { img: "/looks/look-26.jpg", pos: [19.7, 2.3, -11], rotY: -Math.PI / 2, w: 1.6, h: 2.0 },
  { img: "/looks/look-29.jpg", pos: [19.7, 2.3, -15], rotY: -Math.PI / 2, w: 1.6, h: 2.0 },
  // Atrio — muro frontal z=0 (mira -z)
  { img: "/looks/look-42.jpg", pos: [-5, 2.3, -0.25], rotY: Math.PI, w: 1.7, h: 2.1 },
  { img: "/looks/look-19.jpg", pos: [5, 2.3, -0.25], rotY: Math.PI, w: 1.7, h: 2.1 },
  // Atrio — muro de fondo z=-22 (mira +z), flanqueando la puerta
  { img: "/looks/look-37.jpg", pos: [-5, 2.3, -21.75], rotY: 0, w: 1.7, h: 2.1 },
  { img: "/looks/look-40.jpg", pos: [5, 2.3, -21.75], rotY: 0, w: 1.7, h: 2.1 },
  // Sala del fondo — muros laterales
  { img: "/looks/look-31.jpg", pos: [-7.7, 2.3, -28], rotY: Math.PI / 2, w: 1.6, h: 2.0 },
  { img: "/looks/look-08.jpg", pos: [7.7, 2.3, -28], rotY: -Math.PI / 2, w: 1.6, h: 2.0 },
];
