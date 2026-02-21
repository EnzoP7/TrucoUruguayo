import { Metadata } from 'next'

// Dominio de producción dinámico
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trucouruguayo.onrender.com";

export const metadata: Metadata = {
  title: 'Jugar Truco Uruguayo Online Gratis con Amigos',
  description: 'Crea o unite a partidas de Truco Uruguayo online. Modos 1v1, 2v2, 3v3 en tiempo real. 100% gratis.',
  alternates: {
    canonical: `${SITE_URL}/lobby`,
    languages: {
      es: `${SITE_URL}/lobby`,
      "x-default": `${SITE_URL}/lobby`,
    },
  },
  openGraph: {
    title: 'Jugar Truco Uruguayo Online Gratis con Amigos',
    description: 'Crea o unite a partidas de Truco Uruguayo online. Modos 1v1, 2v2, 3v3 en tiempo real.',
    url: `${SITE_URL}/lobby`,
    type: 'website',
  },
  twitter: {
    title: 'Jugar Truco Uruguayo Online Gratis',
    description: 'Crea partidas de Truco Uruguayo y juga con amigos en tiempo real.',
  },
}

export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
