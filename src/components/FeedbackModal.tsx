'use client'

import { useState } from 'react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

type TipoFeedback = 'sugerencia' | 'error' | 'mejora' | 'otro'

const TIPOS: { value: TipoFeedback; label: string; icon: string }[] = [
  { value: 'sugerencia', label: 'Sugerencia', icon: '💡' },
  { value: 'mejora', label: 'Mejora', icon: '🚀' },
  { value: 'error', label: 'Reportar Bug', icon: '🐛' },
  { value: 'otro', label: 'Otro', icon: '💬' },
]

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [tipo, setTipo] = useState<TipoFeedback>('sugerencia')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      const response = await fetch('/api/sugerencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, tipo, mensaje }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar')
      }

      setEnviado(true)
      // Reset form
      setNombre('')
      setEmail('')
      setTipo('sugerencia')
      setMensaje('')

      // Cerrar despues de 3 segundos
      setTimeout(() => {
        setEnviado(false)
        onClose()
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl w-full max-w-lg border border-celeste-500/30 bg-gradient-to-br from-celeste-900/30 to-wood-900/90 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-celeste-600/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-celeste-500 to-celeste-600 flex items-center justify-center">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Enviar Sugerencia</h2>
              <p className="text-celeste-400/60 text-xs">Ayudanos a mejorar el juego</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gold-400/60 hover:text-gold-300 hover:bg-white/10 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {enviado ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Enviado!</h3>
              <p className="text-gold-300/70">Gracias por tu feedback. Lo revisaremos pronto.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo de feedback */}
              <div>
                <label className="block text-white/70 text-sm mb-2">Tipo de mensaje</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipo(t.value)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        tipo === t.value
                          ? 'bg-celeste-600/40 border-2 border-celeste-400/50 text-white'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xl block mb-1">{t.icon}</span>
                      <span className="text-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-white/70 text-sm mb-2">
                  Tu nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  minLength={2}
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-celeste-400 focus:ring-2 focus:ring-celeste-500/30 outline-none transition-all"
                  placeholder="Como te llamas?"
                />
              </div>

              {/* Email (opcional) */}
              <div>
                <label className="block text-white/70 text-sm mb-2">
                  Email <span className="text-white/40">(opcional, para respuesta)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-celeste-400 focus:ring-2 focus:ring-celeste-500/30 outline-none transition-all"
                  placeholder="tu@email.com"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-white/70 text-sm mb-2">
                  Tu mensaje <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-celeste-400 focus:ring-2 focus:ring-celeste-500/30 outline-none transition-all resize-none"
                  placeholder="Contanos tu idea, sugerencia o problema..."
                />
                <div className="text-right text-xs text-white/40 mt-1">
                  {mensaje.length}/2000
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={enviando || !nombre.trim() || mensaje.length < 10}
                className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-celeste-600 to-celeste-500 text-white hover:from-celeste-500 hover:to-celeste-400 transition-all shadow-lg shadow-celeste-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {enviando ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar Sugerencia
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 pb-5">
          <p className="text-center text-white/40 text-xs">
            Tambien podes escribirnos a{' '}
            <a href="mailto:enzopch2022@gmail.com" className="text-celeste-400 hover:underline">
              enzopch2022@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
