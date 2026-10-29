import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Coins, TrendingUp, Wallet, PiggyBank } from 'lucide-react'
import type { CompoundSimInput, CompoundSimResult } from '@financeiro/shared'

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function parseCurrency(v: string): number {
  const n = Number(v.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100)
}

/** Mesma fórmula do backend (simulatorService), calculada no cliente p/ resposta instantânea. */
function simulate(input: CompoundSimInput): CompoundSimResult {
  const months = Math.max(0, Math.floor(input.months))
  const monthlyRate = Math.pow(1 + input.annualReturnPct / 100, 1 / 12) - 1
  const monthlyDy = input.annualDividendYieldPct / 100 / 12
  let balance = input.initialAmount
  let invested = input.initialAmount
  let accumulatedDividends = 0
  const points = []
  for (let m = 1; m <= months; m++) {
    balance = Math.round(balance * (1 + monthlyRate)) + input.monthlyContribution
    invested += input.monthlyContribution
    const dividends = Math.round(balance * monthlyDy)
    accumulatedDividends += dividends
    points.push({ month: m, invested, balance, dividends, accumulatedDividends })
  }
  const finalBalance = points.length ? points[points.length - 1].balance : input.initialAmount
  const totalInvested = points.length ? points[points.length - 1].invested : input.initialAmount
  return {
    points, finalBalance, totalInvested,
    totalReturn: finalBalance - totalInvested,
    totalDividends: accumulatedDividends,
    monthlyDividendAtEnd: Math.round(finalBalance * monthlyDy),
  }
}

export default function SimulatorSection() {
  const [initial, setInitial] = useState('1.000,00')
  const [monthly, setMonthly] = useState('100,00')
  const [years, setYears] = useState('10')
  const [returnPct, setReturnPct] = useState('10')
  const [dyPct, setDyPct] = useState('8')

  const result = useMemo(() => {
    const months = Math.round((Number(years.replace(',', '.')) || 0) * 12)
    return simulate({
      initialAmount: parseCurrency(initial),
      monthlyContribution: parseCurrency(monthly),
      months,
      annualReturnPct: Number(returnPct.replace(',', '.')) || 0,
      annualDividendYieldPct: Number(dyPct.replace(',', '.')) || 0,
    })
  }, [initial, monthly, years, returnPct, dyPct])

  const chart = result.points.filter((_, i) => i % Math.max(1, Math.floor(result.points.length / 60)) === 0 || i === result.points.length - 1)
    .map((p) => ({
      mes: p.month,
      Patrimônio: p.balance / 100,
      Aportado: p.invested / 100,
    }))

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-700">
          <Coins className="h-4 w-4 text-amber-500" /> Simulador de aportes e proventos
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">Aporte inicial</label>
            <input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">Aporte mensal</label>
            <input value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">Prazo (anos)</label>
            <input value={years} onChange={(e) => setYears(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">Rent. a.a. (%)</label>
            <input value={returnPct} onChange={(e) => setReturnPct(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">DY a.a. (%)</label>
            <input value={dyPct} onChange={(e) => setDyPct(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Wallet className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wider">Patrimônio final</span></div>
          <p className="mt-1 text-lg font-bold text-gray-900 lg:text-xl">{fmt(result.finalBalance)}</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-gray-300 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><PiggyBank className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wider">Total aportado</span></div>
          <p className="mt-1 text-lg font-bold text-gray-700 lg:text-xl">{fmt(result.totalInvested)}</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><TrendingUp className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wider">Rendimento</span></div>
          <p className="mt-1 text-lg font-bold text-emerald-600 lg:text-xl">{fmt(result.totalReturn)}</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-amber-400 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400"><Coins className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wider">Dividendo/mês no fim</span></div>
          <p className="mt-1 text-lg font-bold text-amber-600 lg:text-xl">{fmt(result.monthlyDividendAtEnd)}</p>
          <p className="text-[11px] text-gray-400">acum.: {fmt(result.totalDividends)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-gray-700">Evolução projetada</h2>
        {chart.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Informe um prazo para simular.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}m`} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} labelFormatter={(l) => `Mês ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Patrimônio" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Aportado" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2 text-[10px] text-gray-400">
          Simulação ilustrativa de juros compostos. Rentabilidade e dividendos passados não garantem resultados futuros.
        </p>
      </div>
    </div>
  )
}
