import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tutorial - Aprende a Jugar Truco Uruguayo',
  description: 'Aprende las reglas del Truco Uruguayo con nuestro tutorial interactivo. Piezas, Bravos, Envido, Flor, Truco y estrategias basicas. Guia completa para principiantes.',
  openGraph: {
    title: 'Tutorial Truco Uruguayo - Aprende las Reglas',
    description: 'Tutorial interactivo para aprender Truco Uruguayo. Piezas, Bravos, Envido, Flor y mas.',
  },
  keywords: [
    'tutorial truco uruguayo',
    'como jugar truco',
    'reglas truco uruguayo',
    'aprender truco',
    'piezas truco',
    'bravos truco',
    'envido truco',
    'flor truco',
  ],
}

export default function TutorialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
