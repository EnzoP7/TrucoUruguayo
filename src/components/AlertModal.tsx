'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm'

export interface AlertModalState {
  isOpen: boolean
  type: AlertType
  title: string
  message: string
  onConfirm?: () => void
  onCancel?: () => void
}

interface AlertModalProps extends AlertModalState {
  onClose: () => void
}

const ICONS: Record<AlertType, { icon: string; bg: string; border: string }> = {
  success: { icon: '✓', bg: 'from-green-500 to-emerald-600', border: 'border-green-500/30' },
  error: { icon: '✕', bg: 'from-red-500 to-rose-600', border: 'border-red-500/30' },
  warning: { icon: '!', bg: 'from-amber-500 to-orange-600', border: 'border-amber-500/30' },
  info: { icon: 'i', bg: 'from-blue-500 to-cyan-600', border: 'border-blue-500/30' },
  confirm: { icon: '?', bg: 'from-amber-500 to-orange-600', border: 'border-amber-500/30' },
}

export default function AlertModal({ isOpen, type, title, message, onConfirm, onCancel, onClose }: AlertModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    if (type === 'confirm' && onCancel) {
      onCancel()
    }
    onClose()
  }, [type, onCancel, onClose])

  const handleConfirm = useCallback(() => {
    if (onConfirm) onConfirm()
    onClose()
  }, [onConfirm, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      if (e.key === 'Enter' && type !== 'confirm') handleClose()
      if (e.key === 'Enter' && type === 'confirm') handleConfirm()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, type, handleClose, handleConfirm])

  if (!isOpen) return null

  const config = ICONS[type]

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        className={`glass rounded-2xl w-full max-w-sm border ${config.border} bg-gradient-to-br from-wood-900/95 to-wood-950/95 shadow-2xl transform transition-all duration-200 scale-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Content */}
        <div className="p-6 text-center">
          <div className={`w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br ${config.bg} flex items-center justify-center shadow-lg`}>
            <span className="text-white text-2xl font-bold">{config.icon}</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-gold-300/70 text-sm leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className={`px-6 pb-6 ${type === 'confirm' ? 'flex gap-3' : ''}`}>
          {type === 'confirm' ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl font-medium bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-400 hover:to-rose-500 transition-all shadow-lg shadow-red-600/20"
              >
                Confirmar
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${
                type === 'success'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500 shadow-green-600/20'
                  : type === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-400 hover:to-rose-500 shadow-red-600/20'
                    : 'bg-gradient-to-r from-gold-600 to-amber-500 text-black hover:from-gold-500 hover:to-amber-400 shadow-gold-600/20'
              }`}
            >
              Aceptar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook para usar el modal fácilmente
export function useAlertModal() {
  const [state, setState] = useState<AlertModalState>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  })

  const showAlert = useCallback((type: AlertType, title: string, message: string) => {
    setState({ isOpen: true, type, title, message })
  }, [])

  const showConfirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }, [])

  const closeAlert = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  return { alertState: state, showAlert, showConfirm, closeAlert }
}
