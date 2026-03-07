'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ContactoPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    asunto: 'general',
    mensaje: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');

    try {
      const response = await fetch('/api/email/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setEnviado(true);
        setFormData({ nombre: '', email: '', asunto: 'general', mensaje: '' });
      } else {
        setError(data.error || 'Error al enviar el mensaje');
      }
    } catch {
      setError('Error de conexión. Por favor intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-table-wood">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-celeste-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gold-400/60 hover:text-gold-300 text-sm transition-colors mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </Link>
          <h1 className="font-[var(--font-cinzel)] text-3xl sm:text-4xl font-bold text-gold-400 mb-2">
            Contacto
          </h1>
          <p className="text-gold-300/60 text-sm">Estamos para ayudarte</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Info de contacto */}
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6 border border-gold-800/20">
              <h2 className="text-xl font-bold text-celeste-400 mb-4">Información de Contacto</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-celeste-600/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-celeste-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gold-400">Email</h3>
                    <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:text-celeste-300 transition-colors">
                      enzopch2022@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-celeste-600/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-celeste-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gold-400">Ubicación</h3>
                    <p className="text-gold-300/70">Uruguay</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-celeste-600/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-celeste-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gold-400">Tiempo de Respuesta</h3>
                    <p className="text-gold-300/70">24-48 horas hábiles</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-gold-800/20">
              <h2 className="text-xl font-bold text-celeste-400 mb-4">Preguntas Frecuentes</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gold-400 mb-1">¿Cómo reporto un bug?</h3>
                  <p className="text-gold-300/70 text-sm">
                    Usá el formulario seleccionando &quot;Reportar Bug&quot; o envianos un email detallando el problema.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gold-400 mb-1">¿Cómo elimino mi cuenta?</h3>
                  <p className="text-gold-300/70 text-sm">
                    Contactanos por email solicitando la eliminación de tu cuenta y datos.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gold-400 mb-1">¿Puedo sugerir mejoras?</h3>
                  <p className="text-gold-300/70 text-sm">
                    ¡Por supuesto! Nos encanta recibir feedback. Usá el formulario o el botón de sugerencias en el juego.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="glass rounded-2xl p-6 border border-gold-800/20">
            <h2 className="text-xl font-bold text-celeste-400 mb-4">Envianos un Mensaje</h2>

            {enviado ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-green-400 mb-2">Mensaje Enviado!</h3>
                <p className="text-gold-300/70 mb-4">
                  Gracias por contactarnos. Te responderemos a la brevedad
                  al email que proporcionaste.
                </p>
                <button
                  onClick={() => setEnviado(false)}
                  className="mt-4 px-6 py-2 rounded-lg bg-gold-600/20 text-gold-400 hover:bg-gold-600/30 transition-colors"
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-medium text-gold-400 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-gold-700/30 text-white placeholder-gold-600/50 focus:outline-none focus:border-celeste-500/50 focus:ring-1 focus:ring-celeste-500/30 transition-colors"
                    placeholder="Tu nombre"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gold-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-gold-700/30 text-white placeholder-gold-600/50 focus:outline-none focus:border-celeste-500/50 focus:ring-1 focus:ring-celeste-500/30 transition-colors"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="asunto" className="block text-sm font-medium text-gold-400 mb-1">
                    Asunto
                  </label>
                  <select
                    id="asunto"
                    value={formData.asunto}
                    onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-gold-700/30 text-white focus:outline-none focus:border-celeste-500/50 focus:ring-1 focus:ring-celeste-500/30 transition-colors"
                  >
                    <option value="general">Consulta General</option>
                    <option value="bug">Reportar Bug</option>
                    <option value="sugerencia">Sugerencia</option>
                    <option value="cuenta">Problema con mi Cuenta</option>
                    <option value="privacidad">Privacidad / Datos</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="mensaje" className="block text-sm font-medium text-gold-400 mb-1">
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    required
                    rows={5}
                    value={formData.mensaje}
                    onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-gold-700/30 text-white placeholder-gold-600/50 focus:outline-none focus:border-celeste-500/50 focus:ring-1 focus:ring-celeste-500/30 transition-colors resize-none"
                    placeholder="Describe tu consulta con el mayor detalle posible..."
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-celeste-600 to-celeste-500 text-white font-bold hover:from-celeste-500 hover:to-celeste-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-celeste-600/20"
                >
                  {enviando ? 'Enviando...' : 'Enviar Mensaje'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacidad" className="text-gold-400/60 hover:text-gold-300 transition-colors">Política de Privacidad</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/terminos" className="text-gold-400/60 hover:text-gold-300 transition-colors">Términos de Servicio</Link>
          <span className="text-gold-600/30">|</span>
          <Link href="/sobre-nosotros" className="text-gold-400/60 hover:text-gold-300 transition-colors">Sobre Nosotros</Link>
        </div>
      </div>
    </div>
  );
}
