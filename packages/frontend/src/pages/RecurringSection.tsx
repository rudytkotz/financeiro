import { useState } from 'react'
import { useRecurring, useCreateRecurring, useDeleteRecurring, useUpdateRecurring, useMaterializeRecurring } from '@/hooks/useRecurring'
import { Pencil } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import type { RecurringTransaction } from '@financeiro/shared'
import { Repeat, Plus, Trash2, TrendingUp, TrendingDown, Power, RefreshCw } from 'lucide-react'
import AccountSelect from '@/components/AccountSelect'

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return isNaN(n) || n <= 0 ? 0 : Math.round(n * 100)
}

export default function RecurringSection() {
  const { data: recurring, isLoading } = useRecurring()
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()
  const createRecurring = useCreateRecurring()
  const updateRecurring = useUpdateRecurring()
  const deleteRecurring = useDeleteRecurring()
  const materialize = useMaterializeRecurring()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'despesa' | 'receita'>('despesa')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('5')
  const [error, setError] = useState('')
  const [materializeMsg, setMaterializeMsg] = useState('')

  function resetForm() {
    setEditingId(null)
    setDescription(''); setAmount(''); setKind('despesa'); setCategoryId(''); setAccountId(''); setDayOfMonth('5')
    setShowForm(false); setError('')
  }

  function openEdit(r: RecurringTransaction) {
    setEditingId(r.id)
    setDescription(r.description)
    setAmount((r.amount / 100).toFixed(2).replace('.', ','))
    setKind(r.kind)
    setCategoryId(r.categoryId ?? '')
    setAccountId(r.accountId ?? '')
    setDayOfMonth(String(r.dayOfMonth))
    setError('')
    setShowForm(true)
  }

  function handleSave() {
    const cents = parseCurrency(amount)
    if (!description.trim()) { setError('Informe a descrição.'); return }
    if (cents <= 0) { setError('Informe um valor válido.'); return }
    const day = parseInt(dayOfMonth, 10)
    if (isNaN(day) || day < 1 || day > 31) { setError('Dia do mês deve estar entre 1 e 31.'); return }

    if (editingId) {
      updateRecurring.mutate(
        {
          id: editingId,
          payload: {
            description: description.trim(),
            amount: cents,
            kind,
            categoryId: categoryId || null,
            accountId: accountId || null,
            dayOfMonth: day,
          },
        },
        { onSuccess: resetForm, onError: () => setError('Erro ao salvar a recorrência.') },
      )
      return
    }

    createRecurring.mutate(
      {
        description: description.trim(),
        amount: cents,
        kind,
        categoryId: categoryId || null,
        accountId: accountId || null,
        dayOfMonth: day,
        startMonth: getCurrentMonth(),
      },
      {
        onSuccess: resetForm,
        onError: () => setError('Erro ao criar a recorrência.'),
      },
    )
  }

  function handleMaterialize() {
    materialize.mutate(getCurrentMonth(), {
      onSuccess: (res) => {
        setMaterializeMsg(res.created > 0
          ? `${res.created} lançamento(s) gerado(s) para este mês.`
          : 'Nenhum lançamento pendente para este mês.')
        setTimeout(() => setMaterializeMsg(''), 4000)
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Lançamentos que se repetem todo mês (aluguel, salário, assinaturas).
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleMaterialize}
            disabled={materialize.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Gerar os lançamentos deste mês"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${materialize.isPending ? 'animate-spin' : ''}`} /> Gerar mês atual
          </button>
          <button
            onClick={() => { if (showForm) { resetForm() } else { resetForm(); setShowForm(true) } }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Nova recorrência
          </button>
        </div>
      </div>

      {materializeMsg && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{materializeMsg}</p>
      )}

      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{editingId ? 'Editar recorrência' : 'Nova recorrência'}</h3>
          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel, Salário, Netflix"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 sm:col-span-2"
            />
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">R$</span>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Dia</span>
              <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <button type="button" onClick={() => setKind('despesa')} aria-pressed={kind === 'despesa'}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${kind === 'despesa' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                <TrendingDown className="h-4 w-4" /> Despesa
              </button>
              <button type="button" onClick={() => setKind('receita')} aria-pressed={kind === 'receita'}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${kind === 'receita' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                <TrendingUp className="h-4 w-4" /> Receita
              </button>
            </div>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Sem categoria</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <AccountSelect
              accounts={accounts ?? []}
              value={accountId}
              onChange={setAccountId}
              emptyLabel="Sem conta"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={createRecurring.isPending || updateRecurring.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {(createRecurring.isPending || updateRecurring.isPending) ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : (recurring ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Nenhuma recorrência cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {(recurring ?? []).map((r) => (
            <RecurringItem key={r.id} item={r} accounts={accounts ?? []} onEdit={() => openEdit(r)} onDelete={() => deleteRecurring.mutate(r.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecurringItem({ item, accounts, onEdit, onDelete }: { item: RecurringTransaction; accounts: import('@financeiro/shared').Account[]; onEdit: () => void; onDelete: () => void }) {
  const updateRecurring = useUpdateRecurring()
  const isReceita = item.kind === 'receita'
  const account = item.accountId ? accounts.find((a) => a.id === item.accountId) : null

  return (
    <div className={`flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm ${!item.active ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${isReceita ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <Repeat className={`h-4 w-4 ${isReceita ? 'text-emerald-500' : 'text-red-500'}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{item.description}</p>
          <p className="text-[11px] text-gray-400">
            Todo dia {item.dayOfMonth}{item.endMonth ? ` · até ${item.endMonth}` : ''}
            {account ? ` · ${account.name}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold ${isReceita ? 'text-emerald-600' : 'text-gray-900'}`}>
          {isReceita ? '+' : ''}{formatCurrency(item.amount)}
        </span>
        <button
          onClick={() => updateRecurring.mutate({ id: item.id, payload: { active: !item.active } })}
          className={`rounded-lg p-1.5 transition ${item.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:bg-gray-100'}`}
          title={item.active ? 'Pausar' : 'Ativar'}
        >
          <Power className="h-3.5 w-3.5" />
        </button>
        <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}
