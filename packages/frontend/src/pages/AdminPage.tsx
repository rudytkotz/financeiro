import { useState, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Trash2, UserPlus, Eye } from 'lucide-react'

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
    mutationFn: async () => {
      await api.post('/api/admin/users', { username: newUsername, password: newPassword })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setNewUsername('')
      setNewPassword('')
    },
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/admin/users/${id}`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setViewingUser(null)
    },
  })

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!newUsername || !newPassword) return
    createUser.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administração</h1>

      {/* Create user form */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Criar usuário</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
          <input type="text" placeholder="Usuário" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm flex-1 min-w-[120px]" required />
          <input type="password" placeholder="Senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm flex-1 min-w-[120px]" required />
          <button type="submit" disabled={createUser.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> Criar
          </button>
        </form>
      </div>

      {/* Users list */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Usuários cadastrados</h2>
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Carregando...</p>
        ) : (
          <ul className="divide-y">
            {(users ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">{u.username}</span>
                  {u.isAdmin && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Admin</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewingUser(u)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50" title="Ver transações">
                    <Eye className="h-4 w-4" />
                  </button>
                  {!u.isAdmin && (
                    <button onClick={() => deleteUser.mutate(u.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* View user transactions */}
      {viewingUser && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Transações de: {viewingUser.username}</h2>
            <button onClick={() => setViewingUser(null)} className="text-xs text-gray-500 hover:text-gray-700">Fechar</button>
          </div>
          {!userTransactions || userTransactions.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma transação encontrada.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Data</th>
                    <th className="px-2 py-1.5 text-left">Descrição</th>
                    <th className="px-2 py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(userTransactions as any[]).map((t: any) => (
                    <tr key={t.id}>
                      <td className="px-2 py-1.5 whitespace-nowrap">{t.date}</td>
                      <td className="px-2 py-1.5">{t.description}</td>
                      <td className="px-2 py-1.5 text-right font-medium">{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
