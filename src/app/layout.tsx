import type { Metadata } from 'next'
import { Inter, Cinzel, Permanent_Marker } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const permanentMarker = Permanent_Marker({
  subsets: ['latin'],
  variable: '--font-marker',
  display: 'swap',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Truco Uruguayo Online',
  description: 'Juego de Truco Uruguayo online multijugador - La tradición oriental en tiempo real',
  keywords: ['truco', 'uruguayo', 'cartas', 'juego', 'online', 'multijugador'],
  authors: [{ name: 'Truco Uruguayo' }],
  openGraph: {
    title: 'Truco Uruguayo Online',
    description: 'Jugá al Truco Uruguayo con amigos en tiempo real',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${cinzel.variable} ${permanentMarker.variable}`}>
      <body className={`${inter.className} bg-table-wood`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
