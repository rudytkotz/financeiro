import { useMemo, useState, useCallback } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useDependents } from '@/hooks/useDependents'
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useDeleteAllTransactions,
} from '@/hooks/useMutations'
import TransactionModal from '@/components/TransactionModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import DependentSelector from '@/components/DependentSelector'
import type { Transaction } from '@financeiro/shared'
import {
  ArrowUpDown, ArrowUp, ArrowDown, Trash2,
  CreditCard, Smartphone, Wallet, Banknote,
  Search, Filter, Plus, X, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
const PAYMENT_METHODS = [
  { value: 'credito', label: 'Crédito', shortLabel: 'Créd', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  { value: 'pix', label: 'Pix', shortLabel: 'Pix', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { value: 'debito', label: 'Débito', shortLabel: 'Déb', icon: Wallet, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  { value: 'dinheiro', label: 'Dinheiro', shortLabel: 'Din', icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  { value: 'outros', label: 'Outros', shortLabel: 'Out', icon: Wallet, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-500' },
] as const

function getPm(method: string) {
  return PAYMENT_METHODS.find((m) => m.value === method) ?? PAYMENT_METHODS[4]
}

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatShortCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function getMonthLabel(month: string) {
  const [y, m] = month.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m) - 1]} ${y}`
}

function offsetMonth(ym: string, offset: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type SortField = 'date' | 'description' | 'amount'
type SortDir = 'asc' | 'desc'

// ===========================================================================
export default function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [categoryId, setCategoryId] = useState('')
  const [dependentId, setDependentId] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)

  const filterParams = useMemo(() => {
    const p: Record<string, string> = { month }
    if (categoryId) p.categoryId = categoryId
    return p
  }, [month, categoryId])

  const { data: transactionsData, isLoading } = useTransactions(filterParams)
  const rawTransactions = transactionsData?.transactions ?? []
  const { data: categories } = useCategories()
  const { data: dependents } = useDependents()

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const deleteMutation = useDeleteTransaction()
  const deleteAllMutation = useDeleteAllTransactions()

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    if (categories) for (const c of categories) map.set(c.id, c.name)
    return map
  }, [categories])

  // Filter + sort
  const transactions = useMemo(() => {
    let list = rawTransactions
    if (dependentId) list = list.filter((t) => t.dependentId === dependentId)
    if (paymentMethodFilter) list = list.filter((t) => (t as any).paymentMethod === paymentMethodFilter)
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter((t) => t.description.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortField === 'description') cmp = a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
      else cmp = a.amount - b.amount
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rawTransactions, dependentId, paymentMethodFilter, searchText, sortField, sortDir])

  const total = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions])

  // Summary by payment method
  const pmSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      const pm = (t as any).paymentMethod || 'credito'
      map.set(pm, (map.get(pm) ?? 0) + t.amount)
    }
    return PAYMENT_METHODS.filter((pm) => map.has(pm.value)).map((pm) => ({ ...pm, total: map.get(pm.value)! }))
  }, [transactions])

  const activeFilterCount = [categoryId, dependentId, paymentMethodFilter, searchText].filter(Boolean).length

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); return field }
      setSortDir(field === 'amount' ? 'desc' : 'asc'); return field
    })
  }, [])
  const clearFilters = () => { setCategoryId(''); setDependentId(''); setPaymentMethodFilter(''); setSearchText('') }
  function handleOpenCreate() { setEditingTransaction(null); setModalOpen(true) }
  function handleCloseModal() { setModalOpen(false); setEditingTransaction(null) }
  async function handleSubmit(data: { date: string; description: string; amount: number; categoryId: string; operationType: 'despesa' | 'reembolso'; installmentTotal: number; paymentMethod: string }) {
    if (editingTransaction) await updateMutation.mutateAsync({ id: editingTransaction.id, payload: data })
    else await createMutation.mutateAsync(data)
  }
  function handleOpenDelete(t: Transaction) { setTransactionToDelete(t); setDeleteDialogOpen(true) }
  async function handleConfirmDelete() { if (!transactionToDelete) return; await deleteMutation.mutateAsync(transactionToDelete.id); setDeleteDialogOpen(false); setTransactionToDelete(null) }
  async function handleConfirmDeleteAll() { await deleteAllMutation.mutateAsync(month); setDeleteAllDialogOpen(false) }

  const saveDesc = useCallback(async (id: string, v: string, o: string) => { const x = v.trim(); if (!x || x === o) return; await updateMutation.mutateAsync({ id, payload: { description: x } }) }, [updateMutation])
  const saveCat = useCallback(async (id: string, v: string, o: string) => { if (v === o) return; await updateMutation.mutateAsync({ id, payload: { categoryId: v || null } as any }) }, [updateMutation])
  const savePm = useCallback(async (id: string, v: string) => { await updateMutation.mutateAsync({ id, payload: { paymentMethod: v } as any }) }, [updateMutation])
  const saveAmt = useCallback(async (id: string, display: string, orig: number) => {
    const n = Number(display.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
    if (isNaN(n) || n === 0) return; const c = Math.round(n * 100); if (c === orig) return
    await updateMutation.mutateAsync({ id, payload: { amount: c } })
  }, [updateMutation])

  function SortBtn({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field
    return (
      <button onClick={() => handleSort(field)} className={`inline-flex items-center gap-1 font-semibold text-[11px] uppercase tracking-wider select-none transition ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
        {children}
        {!active && <ArrowUpDown className="h-3 w-3 opacity-50" />}
        {active && sortDir === 'asc' && <ArrowUp className="h-3 w-3" />}
        {active && sortDir === 'desc' && <ArrowDown className="h-3 w-3" />}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Transações</h1>
          <p className="text-xs text-gray-400 mt-0.5">{getMonthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Total do mês — visível quando há transações */}
          {rawTransactions.length > 0 && (
            <div className={`rounded-xl px-3 py-1.5 text-sm font-bold ${total < 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-800'}`}>
              {formatCurrency(total)}
            </div>
          )}
          {/* Excluir todas — fora do painel de filtros */}
          {rawTransactions.length > 0 && (
            <button
              onClick={() => setDeleteAllDialogOpen(true)}
              title="Excluir todas as transações do mês"
              aria-label="Excluir todas as transações do mês"
              className="rounded-xl border border-red-200 bg-white p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition active:scale-95">
            <Plus className="h-4 w-4" /> Nova
          </button>
        </div>
      </div>

      {/* ── MONTH NAV ── */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setMonth(offsetMonth(month, -1))} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50 transition active:scale-95">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={() => setMonth(offsetMonth(month, 1))} className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50 transition active:scale-95">
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* ── SUMMARY PILLS ── */}
      {pmSummary.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {pmSummary.map((pm) => {
            const Icon = pm.icon
            const isActive = paymentMethodFilter === pm.value
            return (
              <button key={pm.value}
                onClick={() => setPaymentMethodFilter(isActive ? '' : pm.value)}
                className={`flex-shrink-0 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-95 ${isActive ? `${pm.bg} ${pm.border} ${pm.color} shadow-sm` : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Icon className="h-3.5 w-3.5" />
                <span>{pm.shortLabel}</span>
                <span className="font-bold">{formatShortCurrency(pm.total)}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── SEARCH + FILTERS ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`relative rounded-xl border p-2.5 shadow-sm transition active:scale-95 ${showFilters || activeFilterCount > 0 ? 'border-primary/30 bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600'}`}>
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">{activeFilterCount}</span>}
        </button>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filtros avançados</span>
            {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[11px] text-primary font-medium hover:underline">Limpar</button>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-gray-400 uppercase">Tipo</label>
              <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Todos</option>
                {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-gray-400 uppercase">Categoria</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Todas</option>
                {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-gray-400 uppercase">Dependente</label>
              <select value={dependentId} onChange={(e) => setDependentId(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Todos</option>
                {(dependents ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-gray-100 p-5 mb-4"><CreditCard className="h-10 w-10 text-gray-300" /></div>
          <p className="text-sm font-semibold text-gray-500">Nenhuma transação</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[200px]">Importe uma fatura ou adicione manualmente</p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden md:block rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="px-4 py-3 text-left"><SortBtn field="date">Data</SortBtn></th>
                  <th className="px-4 py-3 text-left"><SortBtn field="description">Descrição</SortBtn></th>
                  <th className="px-4 py-3 text-right"><SortBtn field="amount">Valor</SortBtn></th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase">Parc.</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">Dependente</th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase">Tipo</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <DeskRow key={t.id} t={t} odd={i % 2 === 1} cats={categories ?? []} deps={dependents ?? []}
                    onDesc={saveDesc} onCat={saveCat} onAmt={saveAmt} onPm={savePm} onDel={handleOpenDelete} />
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="space-y-2.5 md:hidden">
            {transactions.map((t) => (
              <MobCard key={t.id} t={t} cats={categories ?? []} deps={dependents ?? []} catMap={categoryMap}
                onDesc={saveDesc} onCat={saveCat} onAmt={saveAmt} onPm={savePm} onDel={handleOpenDelete} />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <TransactionModal open={modalOpen} onClose={handleCloseModal} onSubmit={handleSubmit} categories={categories ?? []} transaction={editingTransaction} />
      <ConfirmDialog open={deleteDialogOpen} title="Excluir transação" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" cancelLabel="Cancelar" onConfirm={handleConfirmDelete} onCancel={() => { setDeleteDialogOpen(false); setTransactionToDelete(null) }} isLoading={deleteMutation.isPending} />
      <ConfirmDialog open={deleteAllDialogOpen} title="Excluir tudo" message={`Excluir todas as ${transactions.length} transações deste mês?`} confirmLabel="Sim, excluir" cancelLabel="Cancelar" onConfirm={handleConfirmDeleteAll} onCancel={() => setDeleteAllDialogOpen(false)} isLoading={deleteAllMutation.isPending} />
    </div>
  )
}

// ===========================================================================
// DESKTOP ROW
// ===========================================================================
interface RP {
  t: Transaction; odd: boolean
  cats: Array<{ id: string; name: string }>; deps: Array<{ id: string; name: string }>
  onDesc: (id: string, v: string, o: string) => void
  onCat: (id: string, v: string, o: string) => void
  onAmt: (id: string, d: string, o: number) => void
  onPm: (id: string, v: string) => void
  onDel: (t: Transaction) => void
}

function DeskRow({ t, odd, cats, deps, onDesc, onCat, onAmt, onPm, onDel }: RP) {
  const [desc, setDesc] = useState(t.description)
  const [amt, setAmt] = useState(() => (t.amount / 100).toFixed(2).replace('.', ','))
  const pm = getPm((t as any).paymentMethod || 'credito')

  return (
    <tr className={`group transition-colors ${odd ? 'bg-gray-50/30' : ''} hover:bg-primary/[0.02]`}>
      <td className="px-4 py-3 text-xs font-medium text-gray-400 whitespace-nowrap">{formatDate(t.date)}</td>
      <td className="px-4 py-3">
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onDesc(t.id, desc, t.description)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] text-gray-800 transition hover:border-gray-200 hover:bg-white focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <input type="text" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)}
            onBlur={() => onAmt(t.id, amt, t.amount)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`w-[90px] text-right rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] font-semibold transition hover:border-gray-200 hover:bg-white focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 ${t.amount < 0 ? 'text-emerald-600' : 'text-gray-800'}`} />
          {t.amount < 0 && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 px-1">Reembolso</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {t.installmentCurrent && t.installmentTotal
          ? <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{t.installmentCurrent}/{t.installmentTotal}</span>
          : <span className="text-gray-200">—</span>}
      </td>
      <td className="px-4 py-3">
        <select value={t.categoryId ?? ''} onChange={(e) => onCat(t.id, e.target.value, t.categoryId ?? '')}
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-gray-600 transition hover:border-gray-200 hover:bg-white focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10">
          <option value="">Sem categoria</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-3"><DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={deps} /></td>
      <td className="px-4 py-3 text-center">
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPm(t.id, e.target.value)}
          className={`rounded-full ${pm.bg} border ${pm.border} px-2.5 py-1 text-[10px] font-bold ${pm.color} cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition`}>
          {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.shortLabel}</option>)}
        </select>
      </td>
      <td className="px-2 py-3">
        <button onClick={() => onDel(t)} className="rounded-lg p-1.5 text-gray-200 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ===========================================================================
// MOBILE CARD
// ===========================================================================
interface MP extends Omit<RP, 'odd'> { catMap: Map<string, string> }

function MobCard({ t, cats, deps, catMap, onDesc, onCat, onAmt, onPm, onDel }: MP) {
  const [desc, setDesc] = useState(t.description)
  const [amt, setAmt] = useState(() => (t.amount / 100).toFixed(2).replace('.', ','))
  const pm = getPm((t as any).paymentMethod || 'credito')
  const Icon = pm.icon

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm active:shadow-none transition-shadow">
      {/* Top */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg ${pm.bg} p-1.5`}><Icon className={`h-4 w-4 ${pm.color}`} /></div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-gray-400">{formatDate(t.date)}</span>
            {t.installmentCurrent && t.installmentTotal && (
              <span className="text-[9px] font-bold text-gray-300">{t.installmentCurrent}/{t.installmentTotal}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex flex-col items-end gap-0.5">
            <input type="text" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)}
              onBlur={() => onAmt(t.id, amt, t.amount)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className={`w-24 text-right rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-base font-bold transition focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/20 ${t.amount < 0 ? 'text-emerald-600' : 'text-gray-900'}`} />
            {t.amount < 0 && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Reembolso</span>
            )}
          </div>
          <button onClick={() => onDel(t)} className="rounded-lg p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
        onBlur={() => onDesc(t.id, desc, t.description)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="mt-2.5 w-full rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 transition focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10" />

      {/* Bottom chips */}
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto">
        <select value={t.categoryId ?? ''} onChange={(e) => onCat(t.id, e.target.value, t.categoryId ?? '')}
          className="flex-shrink-0 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Sem categoria</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={(t as any).paymentMethod || 'credito'} onChange={(e) => onPm(t.id, e.target.value)}
          className={`flex-shrink-0 rounded-lg border ${pm.border} ${pm.bg} px-2 py-1.5 text-[11px] font-bold ${pm.color} focus:outline-none focus:ring-1 focus:ring-primary`}>
          {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.shortLabel}</option>)}
        </select>
        <div className="flex-1 min-w-0">
          <DependentSelector transactionId={t.id} currentDependentId={t.dependentId} dependents={deps} />
        </div>
      </div>
    </div>
  )
}
