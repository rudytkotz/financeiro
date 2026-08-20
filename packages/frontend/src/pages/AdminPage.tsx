import { useState, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Trash2, UserPlus, Eye, AlertTriangle, Database, Eraser } from 'lucide-react'

interface AdminUser {
  id: string
  username: string
  isAdmin: boolean
  createdAt: string
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [confirmDeleteTransactions, setConfirmDeleteTransactions] = useState(false)
  const [confirmDeleteUserData, setConfirmDeleteUserData] = useState<AdminUser | null>(null)

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => { const { data } = await api.get('/api/admin/users'); return data },
  })

  const { data: userTransactions } = useQuery({
    queryKey: ['admin', 'user-transactions', viewingUser?.id],
    queryFn: async () => { const { data } = await api.get(`/api/admin/users/${viewingUser!.id}/transactions`); return data },
    enabled: !!viewingUser,
  })

  const createUser = useMutation({
    mutationFn: async () => { await api.post('/api/admin/users', { username: newUsername, password: newPassword }) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin'] }); setNewUsername(''); setNewPassword('') },
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/admin/users/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin'] }); setViewingUser(null) },
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

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!newUsername || !newPassword) return
    createUser.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administração</h1>

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

      {/* ── Create user ── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 mb-3">Criar usuário</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <input type="text" placeholder="Usuário" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" required />
          <input type="password" placeholder="Senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" required />
          <button type="submit" disabled={createUser.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition active:scale-95">
            <UserPlus className="h-4 w-4" /> Criar
          </button>
        </form>
      </div>

      {/* ── Users list ── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-800">Usuários ({(users ?? []).length})</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {(users ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${u.isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{u.username}</span>
                    {u.isAdmin && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Admin</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewingUser(u)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 transition" title="Ver transações">
                    <Eye className="h-4 w-4" />
                  </button>
                  {!u.isAdmin && (
                    <>
                      <button onClick={() => setConfirmDeleteUserData(u)} className="rounded-lg p-2 text-orange-500 hover:bg-orange-50 transition" title="Apagar dados">
                        <Eraser className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteUser.mutate(u.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition" title="Excluir usuário">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── View user transactions ── */}
      {viewingUser && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-800">Transações de: <span className="text-primary">{viewingUser.username}</span></h2>
            <button onClick={() => setViewingUser(null)} className="rounded-lg px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 transition">Fechar</button>
          </div>
          {!userTransactions || userTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Nenhuma transação encontrada.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Data</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Descrição</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(userTransactions as any[]).map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{t.date}</td>
                      <td className="px-3 py-2 text-gray-800">{t.description}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${t.amount < 0 ? 'text-emerald-600' : 'text-gray-800'}`}>{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Delete Transactions modal ── */}
      {confirmDeleteTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-orange-100 p-2"><Eraser className="h-5 w-5 text-orange-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Apagar transações?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Isso vai apagar <strong>TODAS</strong> as transações e importações de <strong>todos os usuários</strong>. Categorias, dependentes e rendas serão mantidos.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteTransactions(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
              <button onClick={() => deleteAllTransactions.mutate()} disabled={deleteAllTransactions.isPending}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition active:scale-95">
                {deleteAllTransactions.isPending ? 'Apagando...' : 'Apagar transações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ALL modal ── */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Apagar tudo?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Isso vai apagar <strong>TODAS</strong> as transações, importações, rendas, categorias personalizadas e dependentes de <strong>todos os usuários</strong>. As contas de usuário serão mantidas.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteAll(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
              <button onClick={() => deleteAllData.mutate()} disabled={deleteAllData.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition active:scale-95">
                {deleteAllData.isPending ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete User Data modal ── */}
      {confirmDeleteUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-orange-100 p-2"><Eraser className="h-5 w-5 text-orange-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Apagar dados?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Todas as transações, importações e rendas de <strong>{confirmDeleteUserData.username}</strong> serão apagadas. A conta será mantida.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteUserData(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
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
