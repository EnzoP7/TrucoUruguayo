import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partida en Curso',
  description: 'Partida de Truco Uruguayo en tiempo real.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function GameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
