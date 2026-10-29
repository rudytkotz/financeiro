import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useInvoice, useAccountsSummary,
} from '@/hooks/useAccounts'
import { useDependents } from '@/hooks/useDependents'
import type { AccountSummary } from '@financeiro/shared'
import type { Account, CreateAccountPayload } from '@financeiro/shared'
import AccountModal, { ACCOUNT_TYPES } from '@/components/AccountModal'
import TransferModal from '@/components/TransferModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'
import {
  Wallet, CreditCard, Plus, Trash2, Pencil, Receipt, ChevronLeft, ChevronRight,
  Archive, ArchiveRestore, LayoutGrid, Landmark, TrendingUp, ExternalLink, ArrowLeftRight,
} from 'lucide-react'

function typeInfo(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0]
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

type TabKey = 'overview' | 'contas' | 'cartoes' | 'investimentos' | 'arquivadas'

// Agrupa tipos de conta nas abas
const TAB_TYPES: Record<Exclude<TabKey, 'overview' | 'arquivadas'>, string[]> = {
  contas: ['corrente', 'poupanca', 'carteira', 'outro'],
  cartoes: ['cartao'],
  investimentos: ['investimento'],
}

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const { data: dependents } = useDependents()
  const { data: summaryList } = useAccountsSummary()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [tab, setTab] = useState<TabKey>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [toDelete, setToDelete] = useState<Account | null>(null)

  const all = accounts ?? []
  const active = useMemo(() => all.filter((a) => !a.archived), [all])
  const archived = useMemo(() => all.filter((a) => a.archived), [all])
  const summaryById = useMemo(
    () => new Map((summaryList ?? []).map((s) => [s.accountId, s])),
    [summaryList],
  )
  const totalInvested = useMemo(
    () => (summaryList ?? []).reduce((sum, s) => sum + s.investedCurrent, 0),
    [summaryList],
  )

  // Totais por grupo (apenas contas ativas)
  const saldoContas = useMemo(
    () => active.filter((a) => TAB_TYPES.contas.includes(a.type)).reduce((s, a) => s + a.currentBalance, 0),
    [active],
  )
  const cartoes = useMemo(() => active.filter((a) => a.type === 'cartao'), [active])
  // Patrimônio exibido = saldo das contas + investido real (ativos vinculados).
  // Não somamos o saldo manual das contas tipo "investimento" para não duplicar
  // com o valor real dos ativos.
  const patrimonio = saldoContas

  const counts = {
    contas: active.filter((a) => TAB_TYPES.contas.includes(a.type)).length,
    cartoes: cartoes.length,
    investimentos: active.filter((a) => a.type === 'investimento').length,
    arquivadas: archived.length,
  }

  const TABS: { key: TabKey; label: string; icon: typeof Wallet; count?: number }[] = [
    { key: 'overview', label: 'Visão geral', icon: LayoutGrid },
    { key: 'contas', label: 'Contas', icon: Landmark, count: counts.contas },
    { key: 'cartoes', label: 'Cartões', icon: CreditCard, count: counts.cartoes },
    { key: 'investimentos', label: 'Investimentos', icon: TrendingUp, count: counts.investimentos },
    ...(counts.arquivadas > 0 ? [{ key: 'arquivadas' as TabKey, label: 'Arquivadas', icon: Archive, count: counts.arquivadas }] : []),
  ]

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(acc: Account) { setEditing(acc); setModalOpen(true) }

  async function handleSubmit(payload: CreateAccountPayload) {
    if (editing) await updateAccount.mutateAsync({ id: editing.id, payload })
    else await createAccount.mutateAsync(payload)
  }

  // Lista exibida conforme a aba
  const visibleAccounts = useMemo(() => {
    if (tab === 'arquivadas') return archived
    if (tab === 'overview') return active
    return active.filter((a) => TAB_TYPES[tab].includes(a.type))
  }, [tab, active, archived])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Contas</h1>
          <p className="text-sm text-gray-500">Onde o seu dinheiro está</p>
        </div>
        <div className="flex gap-2">
          {active.length >= 2 && (
            <button onClick={() => setTransferOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 active:scale-95">
              <ArrowLeftRight className="h-4 w-4" /> Transferir
            </button>
          )}
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-95">
            <Plus className="h-4 w-4" /> Nova conta
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="-mx-1 overflow-x-auto px-1 scrollbar-hide">
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm w-max">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4',
                tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
              )}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  tab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
      ) : tab === 'overview' ? (
        <OverviewTab
          patrimonio={patrimonio} saldoContas={saldoContas}
          totalInvested={totalInvested}
          cartoes={cartoes} accounts={active} allAccounts={all} dependents={dependents ?? []} summaryById={summaryById} onCreate={openCreate}
          onEdit={openEdit} onDelete={setToDelete} onArchive={(a) => updateAccount.mutate({ id: a.id, payload: { archived: true } })}
        />
      ) : (
        <AccountGrid
          accounts={visibleAccounts} allAccounts={all} dependents={dependents ?? []} summaryById={summaryById} archivedView={tab === 'arquivadas'}
          onEdit={openEdit} onDelete={setToDelete}
          onArchive={(a) => updateAccount.mutate({ id: a.id, payload: { archived: true } })}
          onRestore={(a) => updateAccount.mutate({ id: a.id, payload: { archived: false } })}
        />
      )}

      <AccountModal
        open={modalOpen} account={editing} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} saving={createAccount.isPending || updateAccount.isPending}
        accounts={all} dependents={dependents ?? []}
      />

      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} accounts={active} />

      <ConfirmDialog
        open={!!toDelete}
        title="Excluir conta"
        message={toDelete ? `Excluir "${toDelete.name}"? As transações vinculadas serão mantidas, mas perderão o vínculo com esta conta.` : ''}
        confirmLabel="Excluir"
        onConfirm={() => { if (toDelete) deleteAccount.mutate(toDelete.id); setToDelete(null) }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

// ===========================================================================
// VISÃO GERAL
// ===========================================================================
interface OverviewProps {
  patrimonio: number
  saldoContas: number
  totalInvested: number
  cartoes: Account[]
  accounts: Account[]
  allAccounts: Account[]
  dependents: import('@financeiro/shared').Dependent[]
  summaryById: Map<string, AccountSummary>
  onCreate: () => void
  onEdit: (a: Account) => void
  onDelete: (a: Account) => void
  onArchive: (a: Account) => void
}

function OverviewTab({ patrimonio, saldoContas, totalInvested, cartoes, accounts, allAccounts, dependents, summaryById, onCreate, onEdit, onDelete, onArchive }: OverviewProps) {
  const limiteTotal = cartoes.reduce((s, c) => s + (c.creditLimit ?? 0), 0)

  // Distribuição do saldo positivo por conta (para a barra de composição)
  const positives = accounts.filter((a) => a.currentBalance > 0 && a.type !== 'cartao')
  const totalPositive = positives.reduce((s, a) => s + a.currentBalance, 0)
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#84cc16']

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <div className="mb-4 rounded-2xl bg-primary/5 p-5"><Wallet className="h-10 w-10 text-primary/50" /></div>
        <p className="text-sm font-semibold text-gray-600">Nenhuma conta cadastrada</p>
        <p className="mt-1 max-w-[240px] text-xs text-gray-400">Adicione suas contas, carteiras e cartões para acompanhar o saldo em um só lugar.</p>
        <button onClick={onCreate} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Criar primeira conta
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Wallet className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Patrimônio</span></div>
          <p className={`mt-1.5 text-xl font-bold lg:text-2xl ${(patrimonio + totalInvested) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(patrimonio + totalInvested)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">Contas + investimentos</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Landmark className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Em contas</span></div>
          <p className={`mt-1.5 text-xl font-bold lg:text-2xl ${saldoContas >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(saldoContas)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">Saldo disponível</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-amber-400 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><TrendingUp className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Investido</span></div>
          <p className="mt-1.5 text-xl font-bold text-gray-900 lg:text-2xl">{formatCurrency(totalInvested)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">Vinculado a contas</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-blue-400 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><CreditCard className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Cartões</span></div>
          <p className="mt-1.5 text-xl font-bold text-gray-900 lg:text-2xl">{cartoes.length}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">Limite: {limiteTotal > 0 ? formatCurrency(limiteTotal) : '—'}</p>
        </div>
      </div>

      {/* Composição do saldo por conta */}
      {totalPositive > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Composição do saldo</span>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {positives.map((a, i) => (
              <div key={a.id} className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(a.currentBalance / totalPositive) * 100}%`, backgroundColor: a.color ?? palette[i % palette.length] }}
                title={`${a.name}: ${formatCurrency(a.currentBalance)}`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {positives.map((a, i) => (
              <div key={a.id} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color ?? palette[i % palette.length] }} />
                <span className="text-gray-600">{a.name}</span>
                <span className="font-semibold text-gray-800">{((a.currentBalance / totalPositive) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Todas as contas */}
      <AccountGrid accounts={accounts} allAccounts={allAccounts} dependents={dependents} summaryById={summaryById} archivedView={false} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} onRestore={() => {}} />
    </div>
  )
}

// ===========================================================================
// GRID DE CONTAS
// ===========================================================================
interface GridProps {
  accounts: Account[]
  allAccounts: Account[]
  dependents: import('@financeiro/shared').Dependent[]
  summaryById: Map<string, AccountSummary>
  archivedView: boolean
  onEdit: (a: Account) => void
  onDelete: (a: Account) => void
  onArchive: (a: Account) => void
  onRestore: (a: Account) => void
}

function AccountGrid({ accounts, allAccounts, dependents, summaryById, archivedView, onEdit, onDelete, onArchive, onRestore }: GridProps) {
  if (accounts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        {archivedView ? 'Nenhuma conta arquivada.' : 'Nenhuma conta nesta categoria.'}
      </p>
    )
  }
  const byId = new Map(allAccounts.map((a) => [a.id, a]))
  const depById = new Map(dependents.map((d) => [d.id, d.name]))
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((acc) => {
        // Cartões vinculados a esta conta (mostrados como chips no card da conta)
        const linkedCards = acc.type !== 'cartao'
          ? allAccounts.filter((a) => a.type === 'cartao' && a.parentAccountId === acc.id && !a.archived)
          : []
        const parent = acc.parentAccountId ? byId.get(acc.parentAccountId) ?? null : null
        const ownerName = acc.dependentId ? depById.get(acc.dependentId) ?? null : null
        return (
          <AccountCard key={acc.id} account={acc} archivedView={archivedView}
            linkedCards={linkedCards} parentAccount={parent} ownerName={ownerName}
            summary={summaryById.get(acc.id) ?? null}
            onEdit={() => onEdit(acc)} onDelete={() => onDelete(acc)}
            onArchive={() => onArchive(acc)} onRestore={() => onRestore(acc)} />
        )
      })}
    </div>
  )
}

interface CardProps {
  account: Account
  archivedView: boolean
  linkedCards: Account[]
  parentAccount: Account | null
  ownerName: string | null
  summary: AccountSummary | null
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
  onRestore: () => void
}

function AccountCard({ account, archivedView, linkedCards, parentAccount, ownerName, summary, onEdit, onDelete, onArchive, onRestore }: CardProps) {
  const navigate = useNavigate()
  const info = typeInfo(account.type)
  const Icon = info.icon
  const accent = account.color ?? undefined

  return (
    <div className="group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl p-2.5" style={{ backgroundColor: accent ? `${accent}18` : undefined }}>
            <Icon className="h-5 w-5 text-primary" style={accent ? { color: accent } : undefined} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{account.name}</p>
            <p className="text-[11px] text-gray-400">
              {info.label}
              {parentAccount && <span className="text-gray-400"> · via {parentAccount.name}</span>}
              {ownerName && <span className="text-violet-400"> · {ownerName}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
          {archivedView ? (
            <button onClick={onRestore} className="rounded-lg p-1.5 text-gray-300 hover:bg-emerald-50 hover:text-emerald-500" title="Restaurar"><ArchiveRestore className="h-3.5 w-3.5" /></button>
          ) : (
            <>
              <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={onArchive} className="rounded-lg p-1.5 text-gray-300 hover:bg-amber-50 hover:text-amber-500" title="Arquivar"><Archive className="h-3.5 w-3.5" /></button>
            </>
          )}
          <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <p className={`mt-3 text-xl font-bold ${account.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
        {formatCurrency(account.currentBalance)}
      </p>

      {/* Investimentos vinculados a esta conta */}
      {summary && summary.investedCurrent > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
            <TrendingUp className="h-3.5 w-3.5" /> Investido
          </span>
          <span className="text-xs font-bold text-amber-700">
            {formatCurrency(summary.investedCurrent)}
            <span className="ml-1 font-normal text-amber-500">· {summary.investmentCount} ativo{summary.investmentCount > 1 ? 's' : ''}</span>
          </span>
        </div>
      )}

      {account.type === 'cartao' && !archivedView && <InvoicePanel account={account} />}

      {/* Cartões vinculados a esta conta */}
      {linkedCards.length > 0 && !archivedView && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {linkedCards.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
              <CreditCard className="h-3 w-3" /> {c.name}
            </span>
          ))}
        </div>
      )}

      {!archivedView && (
        <button
          onClick={() => navigate('/transactions', { state: { accountId: account.id } })}
          className="mt-3 inline-flex items-center gap-1 self-start text-[11px] font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Ver transações
          {summary && summary.transactionCount > 0 && (
            <span className="text-gray-400">({summary.transactionCount})</span>
          )}
        </button>
      )}
    </div>
  )
}

// ===========================================================================
// FATURA DO CARTÃO (com navegação de meses)
// ===========================================================================
function InvoicePanel({ account }: { account: Account }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const { data: invoice, isLoading } = useInvoice(account.id, month)

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      {/* Navegação de mês */}
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          <Receipt className="h-3.5 w-3.5" /> Fatura
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(offsetMonth(month, -1))} className="rounded p-1 text-gray-400 hover:bg-gray-200/60" title="Mês anterior"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="min-w-[70px] text-center text-[11px] font-medium text-gray-600">{monthLabel(month).split(' ')[0].slice(0, 3)}/{month.slice(2, 4)}</span>
          <button onClick={() => setMonth(offsetMonth(month, 1))} className="rounded p-1 text-gray-400 hover:bg-gray-200/60" title="Próximo mês"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-2 text-center text-xs text-gray-400">Carregando...</p>
      ) : invoice ? (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-baseline justify-between">
            <span className="text-gray-500">Total</span>
            <span className="text-base font-bold text-gray-900">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400">Fecha {invoice.closingDate.split('-').reverse().slice(0, 2).join('/')}</span>
            <span className="text-gray-400">Vence {invoice.dueDate.split('-').reverse().slice(0, 2).join('/')}</span>
          </div>
          {invoice.limitUsagePct !== null && (
            <div className="pt-1">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-gray-500">Limite usado</span>
                <span className="font-semibold text-gray-700">{invoice.limitUsagePct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-200">
                <div className={`h-full rounded-full ${invoice.limitUsagePct >= 90 ? 'bg-red-500' : invoice.limitUsagePct >= 70 ? 'bg-amber-400' : 'bg-primary'}`}
                  style={{ width: `${Math.min(invoice.limitUsagePct, 100)}%` }} />
              </div>
            </div>
          )}
          <p className="pt-0.5 text-[10px] text-gray-400">{invoice.transactions.length} lançamento(s) no ciclo</p>
        </div>
      ) : (
        <p className="py-2 text-center text-xs text-gray-400">Sem dados da fatura.</p>
      )}
    </div>
  )
}
