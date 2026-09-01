import { useState, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Trash2, UserPlus, Eye, AlertTriangle, Database, Eraser,
  TrendingDown, TrendingUp, Wallet, Users, ChevronLeft,
  ChevronRight, ArrowUpCircle, Tag, X, ShieldCheck,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string
  username: string
  isAdmin: boolean
  createdAt: string
}

interface UserOverview extends AdminUser {
  month: string
  txCount: number
  totalExpenses: number
  totalRefunds: number
  netAmount: number
  incomeAmount: number
  balance: number | null
  dependentCount: number
  lastTransactionDate: string | null
  topCategories: Array<{ name: string; amount: number }>
  expensesByDependent: Array<{ name: string; amount: number }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(cents: number): string {
  const abs = Math.abs(cents) / 100
  const prefix = cents < 0 ? '-' : ''
  return prefix + abs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtShort(cents: number): string {
  const abs = Math.abs(cents) / 100
  const prefix = cents < 0 ? '-' : ''
  if (abs >= 1000) return prefix + 'R$\u00a0' + (abs / 1000).toFixed(1) + 'k'
  return prefix + 'R$\u00a0' + abs.toFixed(2).replace('.', ',')
}

function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function offsetMonth(ym: string, offset: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[parseInt(m) - 1]} ${y}`
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

// ---------------------------------------------------------------------------
// Stat pill
// ---------------------------------------------------------------------------
function Stat({ label, value, sub, color = 'gray' }: {
  label: string; value: string; sub?: string
  color?: 'gray' | 'red' | 'green' | 'blue' | 'amber'
}) {
  const colors = {
    gray: 'bg-gray-50 text-gray-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl px-3 py-2 ${colors[color]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserCard
// ---------------------------------------------------------------------------
function UserCard({
  u,
  onViewTx,
  onDeleteData,
  onDeleteUser,
}: {
  u: UserOverview
  onViewTx: () => void
  onDeleteData: () => void
  onDeleteUser: () => void
}) {
  const hasActivity = u.txCount > 0
  const balanceColor = u.balance === null ? 'gray' : u.balance >= 0 ? 'green' : 'red'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
            ${u.isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
            {initials(u.username)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900">{u.username}</span>
              {u.isAdmin && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {u.lastTransactionDate
                ? `Última tx: ${u.lastTransactionDate}`
                : 'Sem transações'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onViewTx}
            className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 transition" title="Ver transações">
            <Eye className="h-4 w-4" />
          </button>
          {!u.isAdmin && (
            <>
              <button onClick={onDeleteData}
                className="rounded-lg p-2 text-orange-400 hover:bg-orange-50 transition" title="Apagar dados">
                <Eraser className="h-4 w-4" />
              </button>
              <button onClick={onDeleteUser}
                className="rounded-lg p-2 text-red-400 hover:bg-red-50 transition" title="Excluir usuário">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-4">
        {hasActivity ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Despesas" value={fmtShort(u.totalExpenses)} color="red" />
              <Stat label="Reembolsos" value={fmtShort(Math.abs(u.totalRefunds))} color="green" />
              <Stat label="Renda" value={u.incomeAmount > 0 ? fmtShort(u.incomeAmount) : '—'} color="blue" />
              <Stat
                label="Saldo"
                value={u.balance !== null ? fmtShort(u.balance) : '—'}
                color={balanceColor}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                {u.txCount} transação{u.txCount !== 1 ? 'ões' : ''}
              </span>
              {u.dependentCount > 0 && (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600">
                  {u.dependentCount} dependente{u.dependentCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Top categorias */}
            {u.topCategories.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Top categorias
                </p>
                <div className="space-y-1.5">
                  {u.topCategories.map((c) => {
                    const pct = u.totalExpenses > 0 ? (c.amount / u.totalExpenses) * 100 : 0
                    return (
                      <div key={c.name}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-gray-600 font-medium truncate max-w-[60%]">{c.name}</span>
                          <span className="text-gray-500">{fmt(c.amount)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/50 transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dependentes */}
            {u.expensesByDependent.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Gastos por dependente
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {u.expensesByDependent.map((d) => (
                    <span key={d.name}
                      className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600">
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-gray-400 ml-1">{fmtShort(d.amount)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 py-2 text-center">Sem atividade neste mês</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TxDrawer — lista de transações do usuário
// ---------------------------------------------------------------------------
function TxDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [txMonth, setTxMonth] = useState(getCurrentMonth)

  const { data: txData, isLoading } = useQuery<any[]>({
    queryKey: ['admin', 'user-transactions', user.id, txMonth],
    queryFn: async () => {
      const { data } = await api.get(`/api/admin/users/${user.id}/transactions?month=${txMonth}`)
      return data
    },
  })

  const txList: any[] = txData ?? []
  const total = txList.reduce((s: number, t: any) => s + t.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Transações — <span className="text-primary">{user.username}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{getMonthLabel(txMonth)}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 flex-shrink-0">
          <button onClick={() => setTxMonth((m) => offsetMonth(m, -1))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <input type="month" value={txMonth} onChange={(e) => setTxMonth(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <button onClick={() => setTxMonth((m) => offsetMonth(m, 1))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          ) : txList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Nenhuma transação neste mês.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Data</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Descrição</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Categoria</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-500">Parc.</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {txList.map((t: any) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-400">{t.date}</td>
                    <td className="px-4 py-2 text-gray-800 max-w-[200px] truncate">{t.description}</td>
                    <td className="px-4 py-2 text-gray-500">{t.categoryName ?? '—'}</td>
                    <td className="px-4 py-2 text-center text-gray-400">
                      {t.installmentCurrent && t.installmentTotal
                        ? `${t.installmentCurrent}/${t.installmentTotal}`
                        : '—'}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${t.amount < 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {fmt(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer total */}
        {txList.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
            <span className="text-xs text-gray-500">{txList.length} transações</span>
            <span className={`text-sm font-bold ${total < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
              {fmt(total)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPage
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(getCurrentMonth)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [confirmDeleteTransactions, setConfirmDeleteTransactions] = useState(false)
  const [confirmDeleteUserData, setConfirmDeleteUserData] = useState<AdminUser | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data: overview, isLoading } = useQuery<UserOverview[]>({
    queryKey: ['admin', 'overview', month],
    queryFn: async () => {
      const { data } = await api.get(`/api/admin/overview?month=${month}`)
      return data
    },
  })

  const createUser = useMutation({
    mutationFn: async () => { await api.post('/api/admin/users', { username: newUsername, password: newPassword }) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setNewUsername('')
      setNewPassword('')
      setShowCreateForm(false)
    },
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/admin/users/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin'] }) },
  })

  const deleteUserData = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/admin/users/${id}/data`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin'] }); setConfirmDeleteUserData(null) },
  })

  const deleteAllData = useMutation({
    mutationFn: async () => { await api.delete('/api/admin/data') },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin'] }); setConfirmDeleteAll(false) },
  })

  const deleteAllTransactions = useMutation({
    mutationFn: async () => { await api.delete('/api/admin/transactions') },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin'] }); setConfirmDeleteTransactions(false) },
  })

  const users = overview ?? []

  // Totais globais do mês
  const globalExpenses = users.filter(u => !u.isAdmin).reduce((s, u) => s + u.totalExpenses, 0)
  const globalRefunds = users.filter(u => !u.isAdmin).reduce((s, u) => s + Math.abs(u.totalRefunds), 0)
  const activeUsers = users.filter(u => !u.isAdmin && u.txCount > 0).length
  const totalUsers = users.filter(u => !u.isAdmin).length

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Administração</h1>
          <p className="text-xs text-gray-400 mt-0.5">{getMonthLabel(month)}</p>
        </div>
        <button onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition active:scale-95">
          <UserPlus className="h-4 w-4" /> Novo usuário
        </button>
      </div>

      {/* ── Month nav ── */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setMonth(offsetMonth(month, -1))}
          className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50 transition active:scale-95">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={() => setMonth(offsetMonth(month, 1))}
          className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50 transition active:scale-95">
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* ── Global summary pills ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-red-50 p-1.5"><TrendingDown className="h-4 w-4 text-red-500" /></div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Despesas</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmtShort(globalExpenses)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">total dos usuários</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-emerald-50 p-1.5"><ArrowUpCircle className="h-4 w-4 text-emerald-500" /></div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Reembolsos</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmtShort(globalRefunds)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">total dos usuários</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-blue-50 p-1.5"><TrendingUp className="h-4 w-4 text-blue-500" /></div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ativos</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{activeUsers}/{totalUsers}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">com atividade no mês</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-violet-50 p-1.5"><Wallet className="h-4 w-4 text-violet-500" /></div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Líquido</span>
          </div>
          <p className={`text-lg font-bold ${globalExpenses - globalRefunds < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
            {fmtShort(globalExpenses - globalRefunds)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">despesas − reembolsos</p>
        </div>
      </div>

      {/* ── Create user form ── */}
      {showCreateForm && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Criar usuário</h2>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!newUsername || !newPassword) return; createUser.mutate() }}
            className="flex flex-wrap items-end gap-2">
            <input type="text" placeholder="Usuário" value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" required />
            <input type="password" placeholder="Senha" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" required />
            <button type="submit" disabled={createUser.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition active:scale-95">
              <UserPlus className="h-4 w-4" /> Criar
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
          </form>
        </div>
      )}

      {/* ── User cards ── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {users.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              onViewTx={() => setViewingUser(u)}
              onDeleteData={() => setConfirmDeleteUserData(u)}
              onDeleteUser={() => deleteUser.mutate(u.id)}
            />
          ))}
        </div>
      )}

      {/* ── Danger Zone ── */}
      <div className="rounded-2xl border-2 border-red-200 bg-red-50/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-sm font-bold text-red-700">Zona de perigo</h2>
        </div>
        <p className="text-xs text-red-600/80 mb-4">Ações irreversíveis. Use com cuidado.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirmDeleteTransactions(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 transition active:scale-95">
            <Eraser className="h-4 w-4" /> Apagar todas as transações
          </button>
          <button onClick={() => setConfirmDeleteAll(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition active:scale-95">
            <Database className="h-4 w-4" /> Apagar TODOS os dados
          </button>
        </div>
      </div>

      {/* ── Tx Drawer ── */}
      {viewingUser && <TxDrawer user={viewingUser} onClose={() => setViewingUser(null)} />}

      {/* ── Confirm Delete Transactions ── */}
      {confirmDeleteTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-orange-100 p-2"><Eraser className="h-5 w-5 text-orange-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Apagar transações?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Isso vai apagar <strong>TODAS</strong> as transações e importações de <strong>todos os usuários</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteTransactions(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
              <button onClick={() => deleteAllTransactions.mutate()} disabled={deleteAllTransactions.isPending}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition active:scale-95">
                {deleteAllTransactions.isPending ? 'Apagando...' : 'Apagar transações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ALL ── */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Apagar tudo?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Isso vai apagar <strong>TODAS</strong> as transações, importações, rendas, categorias personalizadas e dependentes de <strong>todos os usuários</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteAll(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
              <button onClick={() => deleteAllData.mutate()} disabled={deleteAllData.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition active:scale-95">
                {deleteAllData.isPending ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete User Data ── */}
      {confirmDeleteUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-orange-100 p-2"><Eraser className="h-5 w-5 text-orange-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Apagar dados?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Todas as transações, importações e rendas de <strong>{confirmDeleteUserData.username}</strong> serão apagadas.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteUserData(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
              <button onClick={() => deleteUserData.mutate(confirmDeleteUserData.id)} disabled={deleteUserData.isPending}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition active:scale-95">
                {deleteUserData.isPending ? 'Apagando...' : 'Apagar dados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
