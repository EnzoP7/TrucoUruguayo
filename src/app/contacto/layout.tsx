import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Contacta con el equipo de Truco Uruguayo Online. Estamos para ayudarte con cualquier consulta, sugerencia o problema.',
};

export default function ContactoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
