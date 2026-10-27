# Roadmap — Plataforma de Controle Financeiro

Documento vivo com o que já foi entregue e o que falta para chegar a uma
plataforma "100% completa" (mantendo tudo gratuito — sem serviços/APIs pagos).

Itens explicitamente **fora de escopo** por decisão do usuário:
- **#9 Integração automática com a B3** — gera custo (agregadores pagos / sem API gratuita confiável).
- **#13 Multi-moeda / multi-idioma** — adiado.
- **#16 Anexos em transações** — adiado.

---

## ✅ Concluído

### Fase 0 — Hardening (base técnica)
- Validação de entrada com Zod em todas as rotas
- Error handler global padronizado
- Segurança: helmet, rate limit (auth), CORS restrito em produção
- Validação de variáveis de ambiente no boot
- Helpers compartilhados (auth, errors)
- Code-splitting no frontend, Error Boundary, estados de erro de API
- Logging por ambiente, health check com verificação de banco
- ESLint + Prettier, testes de rota/integração e de cálculo de investimentos

### Fase 1 — Contas / Carteiras (#1)
- Tabela `accounts` + migration `0014_accounts.sql`
- Vínculo opcional `account_id` em transações
- Service com cálculo de saldo atual (saldo inicial ± movimentação)
- CRUD completo com validação Zod
- Tipos compartilhados, hook `useAccounts`, página `AccountsPage` e item no menu

### Fase 2 — Receitas como transações (#2)
- Coluna `kind` ('despesa' | 'receita') em transações + migration `0015_transaction_kind.sql`
- `createTransaction` trata receita (valor positivo, sempre à vista)
- Dashboard separa despesas de receitas; `balance = (renda fixa + receitas lançadas) - despesas`
- Novos campos no `DashboardSummary`: `transactionIncome`, `totalIncome`
- Modal de transação com alternância Despesa/Receita e seletor de conta
- Observação: ainda não há categorias específicas de receita (reaproveita as existentes)

### Fase 3 — Orçamento por categoria (#3)
- Tabela `budgets` (teto por categoria/mês/usuário) + migration `0016_budgets.sql`
- Service com planejado vs. realizado e % de uso por categoria
- Rotas `GET/PUT /api/budgets` com validação Zod
- Aba "Orçamento" dentro de Transações: barra de progresso, alerta ao chegar a 80% (amarelo) e ao estourar (vermelho)
- Navegação por mês; definir teto inline por categoria

### Fase 4 — Recorrentes e contas a pagar/receber (#4)
- Tabela `recurring_transactions` + migration `0017_recurring_transactions.sql`
- Vínculo `recurring_id` em transações (evita duplicar na materialização)
- CRUD de recorrências (despesa/receita, dia do mês, conta, categoria, pausar/ativar)
- Materialização idempotente do mês (`POST /api/recurring/materialize`)
- Aba "Recorrentes" em Transações com botão "Gerar mês atual"
- Pendente: lembrete automático de vencimento (virá na Fase 8 — alertas Telegram)

### Fase 5 — Cartão de crédito como fatura (#5)
- `invoiceService` calcula a fatura do ciclo (entre fechamento anterior e atual) e uso do limite
- Rota `GET /api/accounts/invoice?accountId&month`
- Formulário de conta com campos de cartão (dia de fechamento, vencimento, limite)
- Painel "Fatura atual" no card da conta (total, fechamento, vencimento, barra de uso do limite)
- Observação: modelo simplificado de ciclo (compras entre fechamento anterior exclusivo e atual inclusivo)

### Fase 6 — Metas financeiras (#6)
- Tabelas `goals` e `goal_contributions` + migration `0018_goals.sql`
- Service com progresso (%, restante) e aportes/retiradas (atualiza acumulado em transação)
- CRUD + aportes com validação Zod
- Página "Metas" (menu próprio): barra de progresso, prazo, registrar aporte inline, estado "meta atingida"

### Fase 7 — Projeções e saúde financeira (#7)
- `projectionService`: médias históricas (últimos ~6 meses), taxa de poupança do mês, projeção de saldo dos próximos 6 meses (recorrentes + média de gastos)
- Rota `GET /api/dashboard/health`
- Seção "Saúde financeira" no Painel: indicadores (taxa de poupança, gasto médio, sobra média, metas) + gráfico de projeção (saldo mensal + acumulado)

---

## 🚧 Próximas fases

### Fase 8 — Alertas via Telegram (#8)
- [ ] Bot envia alertas: orçamento estourado, conta a vencer, meta atingida

### Fase 9 — Mais classes de ativos (#10)
- [ ] Cripto e moeda estrangeira (fontes gratuitas de cotação)
- [ ] Tesouro Direto / previdência

### Fase 10 — Proventos projetados / calendário (#11)
- [ ] Projeção de proventos futuros e yield on cost
- [ ] Calendário de pagamentos

### Fase 11 — Recuperação de senha via Telegram (#12)
- [ ] Código de redefinição enviado ao chat vinculado

### Fase 12 — Exportação e relatórios (#14)
- [ ] Exportar transações (CSV)
- [ ] Relatórios anuais / comparativo entre meses

### Fase 13 — PWA instalável (#15)
- [ ] Manifest + service worker (instalável, ícone na home)
