import { useState } from 'react'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounts'
import type { Account, AccountType } from '@financeiro/shared'
import { Wallet, CreditCard, PiggyBank, Landmark, Banknote, TrendingUp, Plus, Trash2, Pencil, Check } from 'lucide-react'

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: 'corrente', label: 'Conta corrente', icon: Landmark },
  { value: 'poupanca', label: 'Poupança', icon: PiggyBank },
  { value: 'carteira', label: 'Carteira', icon: Wallet },
  { value: 'cartao', label: 'Cartão de crédito', icon: CreditCard },
  { value: 'investimento', label: 'Investimento', icon: TrendingUp },
  { value: 'outro', label: 'Outro', icon: Banknote },
]

function typeInfo(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0]
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('corrente')
  const [initialBalance, setInitialBalance] = useState('0,00')
  const [error, setError] = useState('')

  const totalBalance = (accounts ?? []).reduce((sum, a) => sum + a.currentBalance, 0)

  function handleCreate() {
    if (!name.trim()) { setError('Informe o nome da conta.'); return }
    createAccount.mutate(
      { name: name.trim(), type, initialBalance: parseCurrency(initialBalance) },
      {
        onSuccess: () => {
          setName(''); setType('corrente'); setInitialBalance('0,00'); setShowForm(false); setError('')
        },
        onError: () => setError('Erro ao criar a conta.'),
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas</h1>
          <p className="text-sm text-gray-500">Onde o seu dinheiro está</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Nova conta
        </button>
      </div>

      {/* Saldo total */}
      <div className="rounded-xl border border-l-4 border-l-primary/50 bg-white p-5 shadow-sm">
        <span className="text-sm font-medium text-gray-500">Saldo total</span>
        <p className={`mt-1 text-2xl font-bold ${totalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nova conta</h2>
          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Carteira..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select
              value={type} onChange={(e) => setType(e.target.value as AccountType)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">R$</span>
              <input
                type="text" inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Saldo inicial"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setError('') }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleCreate} disabled={createAccount.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {createAccount.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : (accounts ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Nenhuma conta cadastrada. Crie a primeira para controlar seu saldo.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(accounts ?? []).map((acc) => (
            <AccountCard key={acc.id} account={acc} onDelete={() => deleteAccount.mutate(acc.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountCard({ account, onDelete }: { account: Account; onDelete: () => void }) {
  const info = typeInfo(account.type)
  const Icon = info.icon
  const updateAccount = useUpdateAccount()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.name)

  function save() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== account.name) {
      updateAccount.mutate({ id: account.id, payload: { name: trimmed } })
    }
    setEditing(false)
  }

  return (
    <div className="group rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2" style={account.color ? { backgroundColor: `${account.color}22` } : undefined}>
            <Icon className="h-5 w-5 text-primary" style={account.color ? { color: account.color } : undefined} />
          </div>
          {editing ? (
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(account.name); setEditing(false) } }}
              className="rounded border border-primary/40 px-2 py-1 text-sm focus:outline-none"
            />
          ) : (
            <div>
              <p className="text-sm font-semibold text-gray-800">{account.name}</p>
              <p className="text-[11px] text-gray-400">{info.label}</p>
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
          {editing ? (
            <button onClick={save} className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" title="Salvar"><Check className="h-3.5 w-3.5" /></button>
          ) : (
            <button onClick={() => setEditing(true)} className="rounded p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
          )}
          <button onClick={onDelete} className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <p className={`mt-3 text-lg font-bold ${account.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
        {formatCurrency(account.currentBalance)}
      </p>
    </div>
  )
}
