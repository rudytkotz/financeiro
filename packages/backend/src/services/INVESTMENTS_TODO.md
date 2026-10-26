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
- [x] Integrar série real do IPCA (série 433 do BC, acumulado 12m)
- [x] Alertar sobre vencimentos próximos (próximos 60 dias)

## v3 — proventos e dividendos (implementado)
- [x] Registrar proventos recebidos (dividendos, JCP, rendimentos de FII)
- [x] Calcular dividend yield da carteira e yield on cost
- [x] Histórico de proventos + gráfico mensal (12 meses)
- [x] Buscar histórico de dividendos do Yahoo (endpoint disponível, usado sob demanda)

## v4 — análise e relatórios (implementado em grande parte)
- [x] Gráfico de pizza da alocação da carteira (por ativo e por classe)
- [x] Comparação aportado vs CDI (100%) em gráfico de linha mensal
- [x] Snapshots mensais reais do patrimônio (gravados ao abrir a página; gráfico usa reais após 2 meses)
- [x] Abas separadas para Renda Variável e Renda Fixa, com agrupamento por classe
- [x] Rebalanceamento: metas de alocação por classe + sugestão de aportes
- [ ] Benchmark vs IBOV além do CDI (endpoint ^BVSP via Yahoo — pendente)
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
