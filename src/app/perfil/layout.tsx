import { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trucouruguayo.onrender.com";

export const metadata: Metadata = {
  title: 'Mi Perfil',
  description: 'Tu perfil de Truco Uruguayo. Estadisticas, logros, tienda de cosmeticos, personalización de mesa y mas.',
  alternates: {
    canonical: `${SITE_URL}/perfil`,
  },
  openGraph: {
    title: 'Mi Perfil - Truco Uruguayo Online',
    description: 'Estadisticas, logros y cosmeticos de tu cuenta de Truco Uruguayo.',
    url: `${SITE_URL}/perfil`,
    type: 'website',
  },
}

export default function PerfilLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
