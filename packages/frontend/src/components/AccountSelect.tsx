import { useMemo } from 'react'
import type { Account } from '@financeiro/shared'

export interface AccountSelectProps {
  accounts: Account[]
  value: string
  onChange: (accountId: string) => void
  /** Texto da opção vazia. */
  emptyLabel?: string
  /** Quando true, mostra primeiro o grupo de cartões (ex: pagamento no crédito). */
  preferCards?: boolean
  /** Filtra os tipos exibidos. Ex: ['investimento'] para a tela de investimentos. */
  onlyTypes?: Account['type'][]
  id?: string
  className?: string
}

/**
 * Seletor de conta/cartão padronizado e usado em transações, recorrentes,
 * importação e investimentos — para que todos os módulos "conversem" com o
 * mesmo conceito de conta. Agrupa as opções em Cartões e Contas/carteiras e
 * mostra, para cada cartão, a conta à qual ele está vinculado.
 */
export default function AccountSelect({
  accounts,
  value,
  onChange,
  emptyLabel = 'Nenhuma',
  preferCards = false,
  onlyTypes,
  id,
  className = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
}: AccountSelectProps) {
  const visible = useMemo(
    () => accounts.filter((a) => !a.archived && (!onlyTypes || onlyTypes.includes(a.type))),
    [accounts, onlyTypes],
  )
  const cards = useMemo(() => visible.filter((a) => a.type === 'cartao'), [visible])
  const others = useMemo(() => visible.filter((a) => a.type !== 'cartao'), [visible])
  const nameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const cardGroup = cards.length > 0 && (
    <optgroup label="Cartões de crédito">
      {cards.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}{a.parentAccountId ? ` (${nameById.get(a.parentAccountId) ?? ''})` : ''}
        </option>
      ))}
    </optgroup>
  )

  const otherGroup = others.length > 0 && (
    <optgroup label="Contas e carteiras">
      {others.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </optgroup>
  )

  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{emptyLabel}</option>
      {preferCards ? <>{cardGroup}{otherGroup}</> : <>{otherGroup}{cardGroup}</>}
    </select>
  )
}
