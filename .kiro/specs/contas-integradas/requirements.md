# Requirements Document

## Introduction

A tela de **Contas** do aplicativo de controle financeiro pessoal reúne, em abas (Visão geral, Contas, Cartões, Investimentos, Arquivadas), todas as fontes de valor do usuário: contas correntes/poupança/carteira, cartões de crédito e investimentos. Hoje a tela está confusa e com cálculos incorretos: o card de Patrimônio aparece zerado, o saldo "Em contas" não reflete as transações, o total "Investido" ignora investimentos sem conta vinculada, o card de Cartões não reflete o uso real dos cartões, e não há um fluxo claro para cadastrar/vincular um cartão dentro da própria conta dona dele.

Esta reformulação tem como objetivo tornar a tela **integrada e coerente**: contas, cartões e investimentos devem "conversar" entre si, com cálculos corretos de patrimônio, saldo disponível, total investido e uso de cartões, além de um fluxo direto para vincular cartões a contas.

O escopo abrange o backend (serviços de agregação em Fastify + Drizzle + Postgres) e o frontend (tela de Contas). Não inclui mudança do modelo de sinais de `amount` das transações, que permanece: `amount` positivo = despesa (saída), `amount` negativo = receita (entrada).

## Glossary

- **Conta**: Registro da tabela `accounts` representando onde o dinheiro está. Possui `type` ∈ {corrente, poupanca, carteira, cartao, investimento, outro}, `initialBalance` (centavos), `parentAccountId` (auto-referência) e `dependentId`.
- **Conta_Operacional**: Conta cujo `type` ∈ {corrente, poupanca, carteira, outro}. Entra no cálculo de "Em contas".
- **Cartao**: Conta cujo `type` = 'cartao'. Possui `closingDay`, `dueDay`, `creditLimit` e, opcionalmente, `parentAccountId` apontando para a Conta dona.
- **Conta_Investimento**: Conta cujo `type` = 'investimento'.
- **Investimento**: Registro da tabela `investments` (renda fixa ou renda variável), com `accountId` opcional indicando a Conta/corretora de custódia.
- **Investimento_Orfao**: Investimento cujo `accountId` é nulo (não vinculado a nenhuma Conta).
- **Transacao**: Registro da tabela `transactions`, com `amount` em centavos (positivo = despesa, negativo = receita), `accountId`, `kind` e `paymentMethod`. Transações com `deletedAt` preenchido estão na lixeira e são desconsideradas.
- **Saldo_Atual**: Saldo calculado de uma Conta = `initialBalance` − soma de `amount` das Transações ativas vinculadas.
- **Valor_Investido_Atual**: Valor atual dos Investimentos: renda variável a preço de mercado (via posições) e renda fixa pelo valor aplicado (`investedAmount`).
- **Patrimonio**: Soma do Saldo_Atual das Contas_Operacionais com o Valor_Investido_Atual de todos os Investimentos (vinculados e órfãos), sem dupla contagem.
- **Uso_Cartao**: Soma das despesas (kind = 'despesa') vinculadas a um Cartão.
- **Sistema_Contas**: Conjunto de serviços de backend e componentes de frontend responsáveis pela tela de Contas.
- **Servico_Resumo**: Serviço de backend que calcula os agregados por conta e os totais da tela (`getAccountsSummary` e correlatos).

## Requirements

### Requirement 1: Cálculo correto do saldo em contas

**User Story:** Como usuário, quero que o card "Em contas" mostre o saldo real disponível somando o saldo das minhas contas operacionais, para que eu confie no valor exibido.

#### Acceptance Criteria

1. THE Servico_Resumo SHALL calcular o Saldo_Atual de cada Conta como `initialBalance` menos a soma de `amount` das Transações ativas vinculadas à Conta.
2. WHEN o Servico_Resumo calcula o saldo das contas, THE Servico_Resumo SHALL desconsiderar Transações cujo `deletedAt` esteja preenchido.
3. THE Servico_Resumo SHALL calcular o total "Em contas" como a soma do Saldo_Atual de todas as Contas_Operacionais não arquivadas.
4. WHEN existe ao menos uma Conta_Operacional não arquivada com Transações vinculadas, THE Sistema_Contas SHALL exibir no card "Em contas" o total "Em contas" calculado.
5. THE Sistema_Contas SHALL excluir Cartões e Contas_Investimento do total "Em contas".
6. IF não existe nenhuma Conta_Operacional não arquivada com Transações vinculadas, THEN THE Sistema_Contas SHALL exibir o card "Em contas" com o valor R$ 0,00.

### Requirement 2: Cálculo correto do total investido

**User Story:** Como usuário, quero que o card "Investido" some todos os meus investimentos cadastrados, para que o valor reflita a realidade mesmo quando o investimento não está vinculado a uma conta.

#### Acceptance Criteria

1. THE Servico_Resumo SHALL calcular o Valor_Investido_Atual de renda fixa como a soma de `investedAmount` dos Investimentos de renda fixa do usuário.
2. THE Servico_Resumo SHALL calcular o Valor_Investido_Atual de renda variável como a soma do valor de mercado das posições com quantidade maior que zero.
3. THE Servico_Resumo SHALL incluir Investimentos_Orfaos no cálculo do total investido.
4. WHEN existe ao menos um Investimento cadastrado com valor maior que zero, THE Sistema_Contas SHALL exibir no card "Investido" o total investido calculado.
5. THE Sistema_Contas SHALL exibir, no card "Investido", a quantidade de Investimentos vinculados a Contas e a quantidade de Investimentos_Orfaos.

### Requirement 3: Cálculo correto do patrimônio

**User Story:** Como usuário, quero que o card "Patrimônio" some meu dinheiro em contas com meus investimentos, para que eu veja meu total consolidado sem valores duplicados.

#### Acceptance Criteria

1. THE Servico_Resumo SHALL calcular o Patrimonio como a soma do total "Em contas" com o total investido de todos os Investimentos.
2. THE Servico_Resumo SHALL incluir o Valor_Investido_Atual dos Investimentos_Orfaos no Patrimonio.
3. THE Servico_Resumo SHALL contar o valor de cada Investimento uma única vez no Patrimonio.
4. WHEN uma Conta_Investimento possui Investimentos vinculados, THE Servico_Resumo SHALL representar o valor dessa Conta_Investimento pelo Valor_Investido_Atual dos Investimentos vinculados em vez do saldo manual, evitando dupla contagem.
5. WHEN existe ao menos uma Conta ou um Investimento com valor maior que zero, THE Sistema_Contas SHALL exibir no card "Patrimônio" o valor calculado do Patrimonio.
6. IF o Patrimonio calculado for negativo, THEN THE Sistema_Contas SHALL exibir o valor do Patrimônio com destaque visual de valor negativo.

### Requirement 4: Resumo correto de cartões

**User Story:** Como usuário, quero que o card "Cartões" reflita meus cartões e seu uso real, para que eu entenda quanto estou comprometendo mesmo quando há transações de crédito ou débito registradas.

#### Acceptance Criteria

1. THE Servico_Resumo SHALL calcular o Uso_Cartao de cada Cartão como a soma de `amount` das Transações ativas com `kind` = 'despesa' vinculadas ao Cartão.
2. THE Sistema_Contas SHALL exibir no card "Cartões" a quantidade de Cartões não arquivados.
3. WHEN ao menos um Cartão possui `creditLimit` definido, THE Sistema_Contas SHALL exibir a soma dos limites dos Cartões no card "Cartões".
4. WHEN existe ao menos um Cartão com Transações de despesa vinculadas, THE Sistema_Contas SHALL exibir no card "Cartões" o Uso_Cartao total dos Cartões.
5. WHERE um Cartão possui `creditLimit` maior que zero, THE Sistema_Contas SHALL exibir o percentual de uso do limite desse Cartão como `Uso_Cartao` dividido pelo `creditLimit`.
6. IF uma Transação de crédito ou débito existe sem `accountId` vinculado a um Cartão, THEN THE Sistema_Contas SHALL desconsiderar essa Transação do Uso_Cartao dos Cartões, mantendo-a contabilizada nos demais resumos (como o total "Em contas" quando vinculada a uma Conta_Operacional).

### Requirement 5: Vincular cartão a uma conta a partir da própria conta

**User Story:** Como usuário, quero cadastrar e vincular um cartão dentro da própria conta (ex: adicionar o cartão da conta RICO a partir da conta RICO), para que o vínculo seja claro e direto.

#### Acceptance Criteria

1. WHERE uma Conta não é um Cartão e não está arquivada, THE Sistema_Contas SHALL exibir no card da Conta uma ação para adicionar um Cartão vinculado a essa Conta.
2. WHEN o usuário aciona a ação de adicionar Cartão a partir de uma Conta, THE Sistema_Contas SHALL abrir o formulário de criação de Cartão com o `parentAccountId` pré-preenchido com o identificador dessa Conta e com o campo editável para que o usuário possa trocar a Conta dona.
3. WHEN o usuário confirma a criação de um Cartão vinculado, THE Servico_Resumo SHALL persistir o Cartão com `parentAccountId` apontando para a Conta dona.
4. IF o usuário tenta vincular uma Conta a si mesma como `parentAccountId`, THEN THE Servico_Resumo SHALL rejeitar a operação com mensagem de validação.
5. IF o usuário informa um `parentAccountId` que não pertence ao usuário, THEN THE Servico_Resumo SHALL rejeitar a operação com erro de validação.
6. THE Sistema_Contas SHALL exibir, no card de cada Conta, os Cartões vinculados a ela.
7. THE Sistema_Contas SHALL exibir, no card de cada Cartão vinculado, o nome da Conta dona do Cartão.

### Requirement 6: Vincular investimentos a contas na tela

**User Story:** Como usuário, quero vincular um investimento a uma conta/corretora e visualizar investimentos ainda não vinculados, para que meus investimentos conversem com minhas contas.

#### Acceptance Criteria

1. THE Sistema_Contas SHALL exibir, no card de cada Conta, o Valor_Investido_Atual e a quantidade de Investimentos vinculados a essa Conta.
2. WHERE existem Investimentos_Orfaos, THE Sistema_Contas SHALL exibir uma seção identificando os Investimentos não vinculados a nenhuma Conta.
3. WHEN o usuário vincula um Investimento_Orfao a uma Conta, THE Servico_Resumo SHALL atualizar o `accountId` do Investimento para a Conta escolhida.
4. IF o usuário tenta vincular um Investimento a uma Conta que não pertence ao usuário, THEN THE Servico_Resumo SHALL rejeitar a operação com erro de validação.
5. WHEN um Investimento passa a ser vinculado a uma Conta, THE Sistema_Contas SHALL atualizar imediatamente o Valor_Investido_Atual exibido no card da Conta, de forma síncrona com a confirmação do vínculo.

### Requirement 7: Integração e consistência da tela

**User Story:** Como usuário, quero que os totais da tela sempre batam entre si e com os cards individuais, para que a tela faça sentido como um todo.

#### Acceptance Criteria

1. THE Servico_Resumo SHALL fornecer, em uma única resposta de resumo, o Saldo_Atual, o Valor_Investido_Atual, a contagem de Investimentos e a contagem de Cartões vinculados por Conta.
2. THE Sistema_Contas SHALL calcular o Patrimonio exibido como a soma consistente do total "Em contas" e do total "Investido" exibidos na mesma tela.
3. WHEN o usuário cria, edita, arquiva ou exclui uma Conta, THE Sistema_Contas SHALL recalcular e reexibir os totais de Patrimônio, "Em contas", "Investido" e "Cartões".
4. WHEN o usuário vincula um Cartão ou um Investimento a uma Conta, THE Sistema_Contas SHALL recalcular e reexibir todos os totais da tela (Patrimônio, "Em contas", "Investido" e "Cartões"), e não apenas os agregados diretamente afetados.
5. THE Servico_Resumo SHALL considerar apenas Contas, Cartões, Investimentos e Transações pertencentes ao usuário autenticado.

### Requirement 8: Estados sem dados e consistência de exibição

**User Story:** Como usuário, quero que a tela trate corretamente os casos sem dados e exiba valores monetários de forma consistente, para que eu não veja informações enganosas.

#### Acceptance Criteria

1. IF o usuário não possui nenhuma Conta cadastrada, THEN THE Sistema_Contas SHALL exibir um estado vazio com ação para criar a primeira Conta.
2. WHERE um Cartão não possui `creditLimit` definido, THE Sistema_Contas SHALL indicar a ausência de limite sem exibir percentual de uso para esse Cartão.
3. THE Sistema_Contas SHALL exibir todos os valores monetários formatados em Real brasileiro (BRL) a partir de valores em centavos.
4. WHEN uma aba de categoria não possui Contas correspondentes, THE Sistema_Contas SHALL exibir mensagem indicando ausência de Contas naquela categoria.
