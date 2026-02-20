'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserPremiumState {
  isPremium: boolean;
  isLoading: boolean;
  userId: number | null;
  premiumExpiry: Date | null;
}

// Cache global para evitar múltiples requests
let cachedPremiumState: UserPremiumState | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minuto de cache

export function useUserPremium() {
  const [state, setState] = useState<UserPremiumState>({
    isPremium: false,
    isLoading: true,
    userId: null,
    premiumExpiry: null,
  });

  const fetchPremiumStatus = useCallback(async () => {
    // Usar cache si está disponible y no expiró
    const now = Date.now();
    if (cachedPremiumState && now - lastFetchTime < CACHE_TTL) {
      setState(cachedPremiumState);
      return;
    }

    try {
      // Obtener usuario del sessionStorage
      const usuarioStr = sessionStorage.getItem('truco_usuario');
      if (!usuarioStr) {
        const newState = {
          isPremium: false,
          isLoading: false,
          userId: null,
          premiumExpiry: null,
        };
        cachedPremiumState = newState;
        lastFetchTime = now;
        setState(newState);
        return;
      }

      const usuario = JSON.parse(usuarioStr);
      const isPremium = usuario.es_premium === 1 || usuario.es_premium === true;

      const newState = {
        isPremium,
        isLoading: false,
        userId: usuario.id || null,
        premiumExpiry: usuario.premium_expiry ? new Date(usuario.premium_expiry) : null,
      };

      cachedPremiumState = newState;
      lastFetchTime = now;
      setState(newState);
    } catch (error) {
      console.error('Error checking premium status:', error);
      setState({
        isPremium: false,
        isLoading: false,
        userId: null,
        premiumExpiry: null,
      });
    }
  }, []);

  useEffect(() => {
    fetchPremiumStatus();

    // Escuchar cambios en sessionStorage (por si se actualiza desde otra pestaña)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'truco_usuario') {
        cachedPremiumState = null; // Invalidar cache
        fetchPremiumStatus();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchPremiumStatus]);

  // Función para refrescar manualmente el estado
  const refresh = useCallback(() => {
    cachedPremiumState = null;
    lastFetchTime = 0;
    fetchPremiumStatus();
  }, [fetchPremiumStatus]);

  return {
    ...state,
    refresh,
  };
}

// Hook simplificado para componentes que solo necesitan saber si mostrar anuncios
export function useShowAds() {
  const { isPremium, isLoading } = useUserPremium();
  return {
    showAds: !isPremium && !isLoading,
    isLoading,
  };
}
