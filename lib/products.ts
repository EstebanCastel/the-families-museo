export type Exhibit = {
  id: string;
  title: string;
  category: string;
  price: string;
  image: string;
  note: string;
  wing: string;
  // posición en el museo (x, z) — el corredor avanza en -z
  position: [number, number];
};

// Sala 02 — LA COLECCIÓN. Cada prenda es una escultura sobre pedestal.
export const exhibits: Exhibit[] = [
  {
    id: "shroud-fur-parka",
    title: "Parka Sudario de Piel",
    category: "Abrigos",
    price: "$1.680.000",
    image: "/looks/look-01.jpg",
    note: "Construida alrededor de una fotografía de la infancia: un abrigo demasiado grande para el cuerpo que lo habitaba.",
    wing: "II · La Colección",
    position: [-4.2, -6],
  },
  {
    id: "studded-leather-harness",
    title: "Arnés de Cuero con Tachas",
    category: "Abrigos",
    price: "$990.000",
    image: "/looks/look-15.jpg",
    note: "Armadura para lo blando. Sostiene el cuerpo como un nombre sostiene a una persona.",
    wing: "II · La Colección",
    position: [4.2, -10],
  },
  {
    id: "fam-23-varsity",
    title: "Varsity Fam 23",
    category: "Tejidos",
    price: "$820.000",
    image: "/looks/look-44.jpg",
    note: "El número veintitrés no pertenecía a ningún equipo. Lo guardamos como una pregunta.",
    wing: "II · La Colección",
    position: [-4.2, -16],
  },
  {
    id: "tartan-salvage-denim",
    title: "Denim Tartán Recuperado",
    category: "Pantalones",
    price: "$740.000",
    image: "/looks/look-23.jpg",
    note: "Cada pierna carga una década distinta de denim. El volumen como protección.",
    wing: "II · La Colección",
    position: [4.2, -20],
  },
  {
    id: "leopard-trapper",
    title: "Máscara Trapper Leopardo",
    category: "Accesorios",
    price: "$450.000",
    image: "/looks/look-34.jpg",
    note: "Un rostro que se niega a ser un rostro. El anonimato es lo más íntimo que hacemos.",
    wing: "II · La Colección",
    position: [-4.2, -26],
  },
  {
    id: "green-cross-balaclava",
    title: "Balaclava Cruz Verde",
    category: "Accesorios",
    price: "$320.000",
    image: "/looks/look-21.jpg",
    note: "Devoción sin iglesia. Llevamos nuestras preguntas sobre la fe como una familia lleva sus silencios.",
    wing: "II · La Colección",
    position: [4.2, -30],
  },
];

export const HALL_LENGTH = 40; // largo del corredor en -z
export const HALL_WIDTH = 14;
