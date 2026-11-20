import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmWord?: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmWord,
  confirmLabel = 'Confirm',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [typedInput, setTypedInput] = useState('');

  if (!isOpen) return null;

  const canConfirm = !confirmWord || typedInput.trim() === confirmWord.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-[#232733] bg-[#12141A] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${
              isDestructive
                ? 'border-rose-800/60 bg-rose-950/40 text-rose-400'
                : 'border-amber-800/60 bg-amber-950/40 text-amber-400'
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          </div>
        </div>

        {confirmWord && (
          <div className="mt-4 rounded-xl border border-[#232733] bg-[#181B22] p-3">
            <p className="text-xs text-gray-400">
              Type <strong className="text-white font-mono">{confirmWord}</strong> to confirm:
            </p>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={confirmWord}
              className="mt-2 w-full rounded-lg border border-[#2B303F] bg-[#0A0B0E] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#00F2FE] focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-[#232733] bg-transparent px-4 py-2 text-sm font-medium text-gray-300 hover:bg-[#181B22] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isLoading}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              isDestructive
                ? 'bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-900/50'
                : 'bg-[#00F2FE] text-black hover:bg-[#25F4EE] disabled:bg-[#00F2FE]/40'
            } disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
