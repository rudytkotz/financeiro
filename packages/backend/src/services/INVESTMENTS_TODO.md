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

## v2 — rentabilidade de renda fixa
- [ ] Integrar índices CDI/Selic/IPCA (brapi tem `/api/v2/prime-rate` e inflação, ou Banco Central API)
- [ ] Calcular valor atualizado da renda fixa com base na taxa contratada e tempo decorrido
- [ ] Mostrar rentabilidade projetada até o vencimento
- [ ] Alertar sobre vencimentos próximos

## v3 — proventos e dividendos
- [ ] Registrar proventos recebidos (dividendos, JCP, rendimentos de FII)
- [ ] Calcular dividend yield da carteira
- [ ] Histórico de proventos por ativo

## v4 — análise e relatórios
- [ ] Gráfico de evolução do patrimônio ao longo do tempo (snapshots mensais)
- [ ] Gráfico de pizza da alocação da carteira (por ativo e por classe)
- [ ] Rentabilidade da carteira vs CDI / IBOV (benchmark)
- [ ] Relatório de imposto de renda (apuração de lucro em vendas, DARF)

## v5 — automação e dados
- [ ] Importar extrato de corretora (CSV da B3/corretoras)
- [ ] Preço médio considerando desdobramentos/grupamentos (eventos corporativos)
- [ ] Cotação em tempo real (requer plano pago da brapi ou outra fonte)
- [ ] Alertas de preço (ativo atingiu X)

## Observações técnicas
- A brapi.dev free tier retorna cotação EOD (fim do dia), não tempo real.
- O token está em `BRAPI_TOKEN` no `.env`.
- Preço médio: compras recalculam PM ponderado (inclui taxas no custo); vendas
  reduzem quantidade mantendo o PM. Não trata eventos corporativos ainda.
- Valores monetários em centavos (bigint). Taxas de RF em `% * 100`.
