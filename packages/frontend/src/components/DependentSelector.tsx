import { useState, useRef } from 'react'
import { useSetTransactionDependent } from '@/hooks/useMutations'
import type { Dependent } from '@financeiro/shared'
import axios from 'axios'

interface DependentSelectorProps {
  transactionId: string
  currentDependentId: string | null
  dependents: Dependent[]
}

export default function DependentSelector({
  transactionId,
  currentDependentId,
  dependents,
}: DependentSelectorProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingDependentId, setPendingDependentId] = useState<string | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const mutation = useSetTransactionDependent()

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value === '' ? null : e.target.value
    try {
      await mutation.mutateAsync({
        id: transactionId,
        payload: { dependentId: value },
      })
    } catch (error: unknown) {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 409 &&
        error.response?.data?.requiresConfirmation
      ) {
        setPendingDependentId(value)
        setShowConfirmModal(true)
      } else {
        // Revert dropdown to previous value
        if (selectRef.current) {
          selectRef.current.value = currentDependentId ?? ''
        }
      }
    }
  }

  async function handleConfirm() {
    setShowConfirmModal(false)
    try {
      await mutation.mutateAsync({
        id: transactionId,
        payload: { dependentId: pendingDependentId, force: true },
      })
    } catch {
      // Revert dropdown on failure
      if (selectRef.current) {
        selectRef.current.value = currentDependentId ?? ''
      }
    }
    setPendingDependentId(null)
  }

  function handleCancel() {
    setShowConfirmModal(false)
    setPendingDependentId(null)
    // Revert dropdown to previous value
    if (selectRef.current) {
      selectRef.current.value = currentDependentId ?? ''
    }
  }

  return (
    <>
      <select
        ref={selectRef}
        defaultValue={currentDependentId ?? ''}
        onChange={handleChange}
        disabled={mutation.isPending}
        className="w-full rounded border border-gray-300 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        <option value="">Nenhum</option>
        {dependents.map((dep) => (
          <option key={dep.id} value={dep.id}>
            {dep.name}
          </option>
        ))}
      </select>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Confirmar substituição</h3>
            <p className="mt-2 text-sm text-gray-600">
              Esta transação já está associada a outro dependente. Deseja substituir?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
