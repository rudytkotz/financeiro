import { useEffect, useState } from 'react'
import type { Account, AccountType, CreateAccountPayload, Dependent } from '@financeiro/shared'
import { X, Landmark, PiggyBank, Wallet, CreditCard, TrendingUp, Banknote } from 'lucide-react'

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: 'corrente', label: 'Conta corrente', icon: Landmark },
  { value: 'poupanca', label: 'Poupança', icon: PiggyBank },
  { value: 'carteira', label: 'Carteira', icon: Wallet },
  { value: 'cartao', label: 'Cartão de crédito', icon: CreditCard },
  { value: 'investimento', label: 'Investimento', icon: TrendingUp },
  { value: 'outro', label: 'Outro', icon: Banknote },
]

// Paleta de cores para identificar contas visualmente
const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#f97316',
  '#14b8a6', '#64748b',
]

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export interface AccountModalProps {
  /** null = criar; Account = editar */
  account: Account | null
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateAccountPayload) => Promise<void>
  saving?: boolean
  /** Lista de contas existentes — usada para vincular um cartão a uma conta pai. */
  accounts?: Account[]
  /** Lista de dependentes — para atrelar a conta a um dependente. */
  dependents?: Dependent[]
}

export default function AccountModal({ account, open, onClose, onSubmit, saving, accounts = [], dependents = [] }: AccountModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('corrente')
  const [initialBalance, setInitialBalance] = useState('0,00')
  const [color, setColor] = useState<string | null>(null)
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [parentAccountId, setParentAccountId] = useState('')
  const [dependentId, setDependentId] = useState('')
  const [error, setError] = useState('')

  // Sincroniza o form sempre que abrir / trocar a conta editada
  useEffect(() => {
    if (!open) return
    setError('')
    if (account) {
      setName(account.name)
      setType(account.type)
      setInitialBalance(formatCents(account.initialBalance))
      setColor(account.color)
      setClosingDay(account.closingDay ? String(account.closingDay) : '')
      setDueDay(account.dueDay ? String(account.dueDay) : '')
      setCreditLimit(account.creditLimit ? formatCents(account.creditLimit) : '')
      setParentAccountId(account.parentAccountId ?? '')
      setDependentId(account.dependentId ?? '')
    } else {
      setName(''); setType('corrente'); setInitialBalance('0,00'); setColor(null)
      setClosingDay(''); setDueDay(''); setCreditLimit(''); setParentAccountId(''); setDependentId('')
    }
  }, [open, account])

  if (!open) return null

  const isCard = type === 'cartao'

  async function handleSave() {
    if (!name.trim()) { setError('Informe o nome da conta.'); return }
    try {
      await onSubmit({
        name: name.trim(),
        type,
        initialBalance: parseCurrency(initialBalance),
        color,
        closingDay: isCard && closingDay ? Number(closingDay) : null,
        dueDay: isCard && dueDay ? Number(dueDay) : null,
        creditLimit: isCard && creditLimit ? parseCurrency(creditLimit) : null,
        parentAccountId: isCard && parentAccountId ? parentAccountId : null,
        dependentId: dependentId || null,
      })
      onClose()
    } catch {
      setError('Erro ao salvar a conta.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">{account ? 'Editar conta' : 'Nova conta'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nome</label>
            <input
              type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Carteira..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Tipo — grade de botões */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((t) => {
                const Icon = t.icon
                const active = type === t.value
                return (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition ${active ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-center leading-tight">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Saldo inicial + cor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {isCard ? 'Saldo inicial' : 'Saldo atual'}
              </label>
              <div className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 focus-within:ring-2 focus-within:ring-primary/30">
                <span className="text-sm text-gray-400">R$</span>
                <input type="text" inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full bg-transparent px-1 py-2 text-sm focus:outline-none" aria-label="Saldo inicial" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cor</label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(color === c ? null : c)}
                    className={`h-5 w-5 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                    style={{ backgroundColor: c }} aria-label={`Cor ${c}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Dependente dono da conta (opcional) */}
          {dependents.length > 0 && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Dono da conta</label>
              <select value={dependentId} onChange={(e) => setDependentId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Eu (pessoal)</option>
                {dependents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-gray-400">Opcional. Marque se esta conta pertence a um dependente.</p>
            </div>
          )}

          {/* Campos de cartão */}
          {isCard && (
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-400">Fechamento</label>
                <input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="28"
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-400">Vencimento</label>
                <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="10"
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-400">Limite</label>
                <input type="text" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {/* Conta vinculada ao cartão (ex: cartão do Nubank → conta Nubank) */}
              <div className="col-span-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-gray-400">Vinculado à conta</label>
                <select value={parentAccountId} onChange={(e) => setParentAccountId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Nenhuma (cartão independente)</option>
                  {accounts
                    .filter((a) => a.type !== 'cartao' && !a.archived && a.id !== account?.id)
                    .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-gray-400">Opcional. Ex: o cartão do Nubank pertence à conta Nubank.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Salvando...' : account ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
