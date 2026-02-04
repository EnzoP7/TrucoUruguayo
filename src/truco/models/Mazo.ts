import { Carta } from '@/types/truco';

// Mazo uruguayo: 40 cartas (sin 8, 9, 10)
export class Mazo {
  private cartas: Carta[] = [];

  constructor() {
    this.reiniciar();
  }

  // Reiniciar el mazo con todas las cartas
  reiniciar(): void {
    this.cartas = [];
    const palos: Array<'oro' | 'copa' | 'espada' | 'basto'> = ['oro', 'copa', 'espada', 'basto'];
    const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]; // Sin 8, 9, 10 (el 10 del mazo es el 11 en valor)

    palos.forEach(palo => {
      valores.forEach(valor => {
        this.cartas.push(this.crearCarta(palo, valor));
      });
    });
  }

  // Crear una carta con su poder según las reglas del Truco Uruguayo
  private crearCarta(palo: 'oro' | 'copa' | 'espada' | 'basto', valor: number): Carta {
    let poder = 0;

    // Jerarquía del Truco Uruguayo (de mayor a menor)
    const jerarquia: { [key: string]: number } = {
      'espada-1': 14,  // Mozo de espadas
      'basto-1': 13,   // Mozo de basto
      'espada-7': 12,  // Siete de espadas
      'oro-7': 11,     // Siete de oro
      'espada-3': 10,  // Tres de espadas
      'basto-3': 9,    // Tres de basto
      'oro-3': 8,      // Tres de oro
      'copa-3': 7,     // Tres de copa
      'espada-2': 6,   // Dos de espadas
      'basto-2': 5,    // Dos de basto
      'oro-2': 4,      // Dos de oro
      'copa-2': 3,     // Dos de copa
      'oro-1': 2,      // Ancho de oro
      'copa-1': 1,     // Ancho de copa
      'espada-12': 0,  // Rey de espadas
      'basto-12': 0,   // Rey de basto
      'oro-12': 0,     // Rey de oro
      'copa-12': 0,    // Rey de copa
      'espada-11': 0,  // Caballo de espadas
      'basto-11': 0,   // Caballo de basto
      'oro-11': 0,     // Caballo de oro
      'copa-11': 0,    // Caballo de copa
      'espada-10': 0,  // Sota de espadas (valor 10 en el mazo)
      'basto-10': 0,   // Sota de basto
      'oro-10': 0,     // Sota de oro
      'copa-10': 0,    // Sota de copa
    };

    const clave = `${palo}-${valor}`;
    poder = jerarquia[clave] || 0;

    return { palo, valor, poder };
  }

  // Barajar las cartas
  barajar(): void {
    for (let i = this.cartas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cartas[i], this.cartas[j]] = [this.cartas[j], this.cartas[i]];
    }
  }

  // Repartir cartas a jugadores
  repartir(cantidadPorJugador: number): Carta[][] {
    const manos: Carta[][] = [];
    let cartaIndex = 0;

    for (let i = 0; i < cantidadPorJugador; i++) {
      manos.push([]);
    }

    for (let i = 0; i < 3; i++) { // 3 cartas por jugador
      for (let j = 0; j < cantidadPorJugador; j++) {
        if (cartaIndex < this.cartas.length) {
          manos[j].push(this.cartas[cartaIndex++]);
        }
      }
    }

    return manos;
  }

  // Obtener cartas restantes
  getCartas(): Carta[] {
    return [...this.cartas];
  }
}