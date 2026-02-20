'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/lib/socket';

export default function PracticaPage() {
  const router = useRouter();
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    const iniciarPartidaPractica = async () => {
      try {
        // Conectar al servidor
        await socketService.connect();

        // Unirse al lobby
        await socketService.joinLobby();

        // Crear partida 1v1 de práctica con nombre "Jugador"
        const mesaId = await socketService.crearPartidaPractica('Jugador');
        if (!mesaId) {
          router.push('/lobby');
          return;
        }

        // Agregar bot
        await socketService.agregarBot('medio');

        // Iniciar partida
        await socketService.iniciarPartida();

        // Redirigir al juego
        router.push(`/game?mesaId=${mesaId}`);

      } catch (err) {
        console.error('Error iniciando práctica:', err);
        // Si falla, ir al lobby
        router.push('/lobby');
      }
    };

    iniciarPartidaPractica();
  }, [router]);

  // Pantalla mínima mientras carga (será muy rápido)
  return (
    <div className="min-h-screen bg-table-wood flex items-center justify-center">
      <div className="text-gold-400 text-xl">Cargando partida...</div>
    </div>
  );
}
