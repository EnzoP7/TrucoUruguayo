import { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trucouruguayo.onrender.com";

export const metadata: Metadata = {
  title: 'Iniciar Sesion',
  description: 'Inicia sesion o crea una cuenta para jugar Truco Uruguayo online. Guarda tu progreso, ranking y estadisticas.',
  alternates: {
    canonical: `${SITE_URL}/login`,
  },
  openGraph: {
    title: 'Iniciar Sesion - Truco Uruguayo Online',
    description: 'Inicia sesion para jugar Truco Uruguayo con tus amigos.',
    url: `${SITE_URL}/login`,
    type: 'website',
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
