import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ranking - Mejores Jugadores',
  description: 'Ranking de los mejores jugadores de Truco Uruguayo Online. Compite por el primer puesto y demuestra que sos el mejor truchero del Uruguay.',
  openGraph: {
    title: 'Ranking Truco Uruguayo - Top Jugadores',
    description: 'Los mejores jugadores de Truco Uruguayo Online. Compite y subi en el ranking.',
  },
}

export default function RankingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
