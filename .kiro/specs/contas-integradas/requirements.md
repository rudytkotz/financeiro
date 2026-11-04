# Requisitos finais — contas integradas

## Estado atual do produto

A implementação principal de contas, cartões e investimentos já está estabilizada e validada. A regra de negócio central é simples e precisa:

- o backend é a fonte de verdade para todos os agregados financeiros;
- a UI consome o contrato de resumo do backend em vez de recalcular valores localmente;
- contas operacionais entram em "Em contas";
- cartões entram em contagem e uso, mas não no saldo operacional;
- investimentos entram no total investido e no patrimônio sem duplicar valores;
- transações com `deletedAt` preenchido e contas arquivadas não participam dos totais ativos.

## Glossário final

- Conta operacional: `type` em `{corrente, poupanca, carteira, outro}`
- Cartão: `type = 'cartao'`, com `closingDay`, `dueDay`, `creditLimit` e `parentAccountId`
- Conta de investimento: `type = 'investimento'`, usada como custódia, não como caixa disponível
- Investimento órfão: investimento sem `accountId`
- Uso do cartão: soma de despesas (`kind = 'despesa'`) ligadas ao cartão
- Patrimônio: saldo operacional + valor investido atual dos investimentos, sem dupla contagem

## Regras de negócio vigentes

### 1. Resumo financeiro

- `getAccountsSummary` e equivalentes devem calcular o saldo por conta, a contagem por tipo e os totais de tela.
- O total "Em contas" considera apenas contas operacionais não arquivadas.
- O total "Investido" inclui investimentos vinculados e órfãos.
- O patrimônio é calculado a partir do saldo operacional e do valor investido, sem duplicar contas de custódia.

### 2. Cartões

- Cartões não entram no saldo operacional.
- O uso do cartão é a soma das despesas em transações ativas ligadas ao cartão.
- `parentAccountId` só faz sentido para conta do tipo cartão.
- Se o tipo deixa de ser cartão, o vínculo deve ser limpo imediatamente.

### 3. Investimentos

- Investimentos podem estar vinculados a contas ou órfãos.
- Investimentos órfãos continuam participando do total investido e do patrimônio.
- Vinculação inválida deve ser rejeitada no backend.

### 4. Validação

- `parentAccountId !== id` deve ser rejeitado.
- `parentAccountId` deve pertencer ao mesmo usuário.
- `deletedAt` deve ser ignorado na agregação.
- `archived` afeta visibilidade e listagem ativa, mas não deve quebrar o contrato de resumo.

## Implementado e validado

- resumo centralizado no backend;
- regras de semântica entre contas, cartões e investimentos;
- cálculo de total investido e patrimônio sem dupla contagem;
- validação de vinculação de cartão e investimento;
- invalidation correta de queries no frontend;
- regressões protegidas por testes de backend e frontend.

## Próximas melhorias aceitáveis

### Fase A — hardening de produto
- definir regra explícita de arquivamento e restauração;
- padronizar zero-state, mensagens e blocos vazios;
- revisar UX de cartões sem limite e investimentos órfãos.

### Fase B — expansão do sistema
- orçamento e limites por categoria;
- dashboard de cartão por mês;
- metas, previsões e alertas financeiros.

## Critério de pronto para a próxima etapa

A próxima etapa pode começar quando:

- o fluxo de contas/cartões/investimentos estiver estável;
- os casos de edge relevantes estiverem cobertos por testes;
- a UX de estado vazio/arquivamento estiver consolidada;
- o contrato do backend continuar sendo a única fonte de verdade para a tela.

Este é o estado final de referência do módulo de contas integradas: funcional, consistente, validado e pronto para evolução incremental sem reescrita de arquitetura.
