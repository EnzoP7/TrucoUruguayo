import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lobby - Crear o Unirse a Partidas',
  description: 'Unite a partidas de Truco Uruguayo en tiempo real. Crea salas 1v1, 2v2 o 3v3. Invita amigos y juga gratis al mejor juego de cartas uruguayo online.',
  openGraph: {
    title: 'Lobby Truco Uruguayo - Partidas en Tiempo Real',
    description: 'Crea o unite a partidas de Truco Uruguayo. Modos 1v1, 2v2, 3v3. Juga gratis con amigos.',
  },
}

export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
