import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Practica - Jugar contra Bot',
  description: 'Practica Truco Uruguayo contra un bot inteligente. Mejora tus habilidades sin afectar tu ranking. Partidas rapidas 1v1 para entrenar.',
  openGraph: {
    title: 'Practica Truco Uruguayo - Juga contra Bot',
    description: 'Entrena Truco Uruguayo contra un bot inteligente. Practica gratis sin afectar tu ranking.',
  },
}

export default function PracticaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
