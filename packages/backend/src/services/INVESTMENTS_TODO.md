# Investimentos — Roadmap de melhorias

## v1 (implementado)
- [x] Nova aba "Investimentos" no menu
- [x] Cadastro de renda variável (ação, FII, ETF, BDR) com ticker
- [x] Cadastro de renda fixa (CDB, Tesouro, LCI, LCA, debênture) com taxa e vencimento
- [x] Operações de compra/venda com cálculo de preço médio ponderado
- [x] Cotação atual via brapi.dev (com cache de 10 min)
- [x] Cálculo de lucro/prejuízo (R$ e %) por ativo e consolidado
- [x] Dashboard de carteira: patrimônio, resultado, divisão RF/RV
- [x] Isolamento por usuário em todas as rotas

## v2 — rentabilidade de renda fixa (implementado)
- [x] Integrar CDI/Selic via API do Banco Central (SGS, gratuita, sem token)
- [x] Calcular valor atualizado da renda fixa com base na taxa contratada (pos_cdi, prefixado, ipca_mais) e tempo decorrido
- [x] Mostrar rendimento estimado de cada ativo de RF
- [ ] Integrar série real do IPCA (hoje usa estimativa de 4.5% a.a. para ipca_mais)
- [ ] Alertar sobre vencimentos próximos

## v3 — proventos e dividendos
- [ ] Registrar proventos recebidos (dividendos, JCP, rendimentos de FII)
- [ ] Calcular dividend yield da carteira
- [ ] Histórico de proventos por ativo

## v4 — análise e relatórios (parcialmente implementado)
- [x] Gráfico de pizza da alocação da carteira (por ativo)
- [x] Comparação aportado vs CDI (100%) em gráfico de linha mensal
- [x] Abas separadas para Renda Variável e Renda Fixa
- [ ] Snapshots mensais reais do patrimônio (hoje reconstrói via aportes + CDI)
- [ ] Benchmark vs IBOV além do CDI
- [ ] Relatório de imposto de renda (apuração de lucro em vendas, DARF)

## v5 — automação e dados
- [ ] Importar extrato de corretora (CSV da B3/corretoras)
- [ ] Preço médio considerando desdobramentos/grupamentos (eventos corporativos)
- [ ] Cotação em tempo real (requer plano pago da brapi ou outra fonte)
- [ ] Alertas de preço (ativo atingiu X)

## Observações técnicas
- **Fonte de cotações: Yahoo Finance** (gratuito, sem token). Tickers da B3 usam
  sufixo `.SA` (ex: PETR4.SA, HGLG11.SA). Cobre ações, FIIs, ETFs e BDRs.
- Fallback: brapi.dev (usado só se o Yahoo falhar E `BRAPI_TOKEN` estiver setado).
- Ambas retornam cotação com atraso (~15 min), não tempo real.
- O endpoint do Yahoo é não-oficial; se ele mudar/bloquear, o fallback brapi cobre.
- Preço médio: compras recalculam PM ponderado (inclui taxas no custo); vendas
  reduzem quantidade mantendo o PM. Não trata eventos corporativos ainda.
- Valores monetários em centavos (bigint). Taxas de RF em `% * 100`.
