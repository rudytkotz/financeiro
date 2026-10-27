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

---

## 🚧 Próximas fases

### Fase 3 — Orçamento por categoria (#3)
- [ ] Tabela `budgets` (teto por categoria por mês)
- [ ] Acompanhamento planejado vs. realizado
- [ ] Alerta visual ao se aproximar/estourar o teto

### Fase 4 — Recorrentes e contas a pagar/receber (#4)
- [ ] Tabela `recurring_transactions`
- [ ] Geração automática mensal
- [ ] Lembretes de vencimento

### Fase 5 — Cartão de crédito como fatura (#5)
- [ ] Ciclo de fatura (fechamento/vencimento) usando campos já criados em `accounts`
- [ ] Fatura atual vs. próxima, uso do limite

### Fase 6 — Metas financeiras (#6)
- [ ] Tabela `goals` (objetivo, valor alvo, prazo)
- [ ] Barra de progresso e aportes

### Fase 7 — Projeções e saúde financeira (#7)
- [ ] Previsão de saldo futuro com base em recorrentes
- [ ] Indicadores: taxa de poupança, quanto sobra

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
