# Requirements Document

## Introduction

Esta especificação descreve uma aplicação web de controle financeiro pessoal. O sistema permite que o usuário importe faturas de cartão de crédito em formato CSV, visualize e categorize seus gastos, divida despesas entre pessoas que compartilham o cartão, registre gastos avulsos (como despesas com casa), e informe sua renda mensal. O acesso é via navegador web, permitindo consulta de qualquer dispositivo conectado à internet.

## Glossary

- **Sistema**: A aplicação web de controle financeiro pessoal.
- **Usuário**: A pessoa proprietária da conta que acessa e gerencia seus dados financeiros.
- **Fatura**: Arquivo CSV exportado da operadora do cartão de crédito contendo as transações do período.
- **Transação**: Um lançamento individual de débito ou crédito presente na fatura ou inserido manualmente.
- **Categoria**: Classificação temática atribuída a uma transação (ex: Alimentação, Transporte, Casa).
- **Dependente**: Pessoa que utiliza o cartão do Usuário e cujas transações devem ser separadas na divisão de gastos.
- **Renda**: Valor mensal informado pelo Usuário representando sua receita (salário ou outras fontes).
- **Parser_CSV**: Componente responsável por interpretar e transformar o arquivo CSV em transações estruturadas.
- **Importador**: Componente que recebe o arquivo CSV, aciona o Parser_CSV e persiste as transações resultantes.
- **Painel**: Tela principal da aplicação que exibe o resumo financeiro do mês.

---

## Requirements

### Requirement 1: Importação de Fatura CSV

**User Story:** Como Usuário, quero importar minha fatura de cartão de crédito em formato CSV, para que minhas transações sejam carregadas automaticamente no sistema sem necessidade de digitação manual.

#### Acceptance Criteria

1. WHEN o Usuário faz upload de um arquivo com extensão `.csv` e tamanho máximo de 10 MB, THE Importador SHALL processar o arquivo e exibir as transações extraídas na interface.
2. WHEN o arquivo CSV é processado com sucesso, THE Importador SHALL persistir as transações associadas ao mês de referência da fatura, determinado pela data mais antiga dentre as transações contidas no arquivo.
3. IF o arquivo enviado não possuir extensão `.csv`, THEN THE Importador SHALL rejeitar o arquivo e exibir a mensagem: "Formato inválido. Por favor, envie um arquivo CSV."
4. IF o arquivo CSV contiver linhas com campos obrigatórios (data, descrição, valor) ausentes ou malformados, THEN THE Importador SHALL ignorar as linhas inválidas, persistir as válidas e exibir um relatório indicando o número de linhas ignoradas e o motivo. IF todas as linhas forem inválidas, THEN THE Importador SHALL rejeitar o arquivo inteiro sem persistir dados e exibir a mensagem: "Nenhuma transação válida encontrada no arquivo."
5. IF o arquivo CSV não puder ser lido por problemas de codificação ou corrupção, THEN THE Importador SHALL rejeitar o arquivo e exibir a mensagem: "Não foi possível processar o arquivo. Verifique se o arquivo está correto e tente novamente."
6. IF o arquivo CSV exceder 10 MB, THEN THE Importador SHALL rejeitar o arquivo antes de processá-lo e exibir a mensagem: "O arquivo excede o tamanho máximo permitido de 10 MB."
7. IF o Usuário tentar importar uma fatura de período já importado anteriormente, THEN THE Importador SHALL exibir um aviso de duplicidade e solicitar confirmação antes de sobrescrever os dados existentes. IF o Usuário cancelar, THEN THE Importador SHALL abortar a importação e manter os dados existentes inalterados.
8. THE Parser_CSV SHALL suportar arquivos CSV codificados em UTF-8 e UTF-8 com BOM.
9. THE Parser_CSV SHALL extrair as mesmas transações independentemente da ordem das colunas no cabeçalho do arquivo CSV.

---

### Requirement 2: Visualização Detalhada dos Gastos

**User Story:** Como Usuário, quero visualizar de forma detalhada todas as minhas transações, para que eu possa entender exatamente para onde meu dinheiro está indo.

#### Acceptance Criteria

1. WHEN o Usuário acessa a listagem de transações de um mês, THE Sistema SHALL exibir todas as transações do período com: data, descrição, valor e categoria atribuída.
2. WHEN o Usuário aplica um filtro por categoria, THE Sistema SHALL exibir somente as transações pertencentes à categoria selecionada e atualizar o valor total exibido.
3. WHEN o Usuário aplica um filtro por intervalo de datas com data de início e data de fim válidas, THE Sistema SHALL exibir somente as transações cuja data esteja dentro do intervalo informado, inclusive as datas de início e fim.
4. IF o intervalo de datas informado contiver data de início posterior à data de fim, ou se alguma das datas for inválida, THEN THE Sistema SHALL ignorar o filtro de datas e exibir todas as transações do mês sem filtro de período.
5. THE Sistema SHALL exibir o valor total das transações listadas após a aplicação de qualquer combinação de filtros ativos, recalculando o total sempre que um filtro for adicionado ou removido.
6. WHILE nenhuma transação estiver cadastrada para o mês selecionado, THE Sistema SHALL exibir a mensagem: "Nenhuma transação encontrada para este período."
7. WHEN o Usuário ordena a listagem por valor em ordem decrescente, THE Sistema SHALL reordenar as transações do maior para o menor valor sem alterar o conjunto de transações exibidas nem os filtros ativos.
8. WHEN o Usuário ordena a listagem por data, THE Sistema SHALL reordenar as transações da mais recente para a mais antiga sem alterar o conjunto de transações exibidas nem os filtros ativos.

---

### Requirement 3: Categorização de Transações

**User Story:** Como Usuário, quero categorizar cada transação, para que eu possa visualizar meus gastos agrupados por tipo e identificar onde gasto mais.

#### Acceptance Criteria

1. THE Sistema SHALL disponibilizar as categorias padrão: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Vestuário, Assinaturas e Outros, visíveis a todos os Usuários sem necessidade de criação.
2. WHEN o Usuário atribui uma Categoria a uma Transação, THE Sistema SHALL persistir a associação e exibi-la na listagem em até 1 segundo após a confirmação.
3. WHEN o Usuário cria uma nova Categoria personalizada com nome único (comparação sem distinção de maiúsculas/minúsculas) e com no máximo 50 caracteres, THE Sistema SHALL adicionar a Categoria à lista de opções disponíveis do Usuário.
4. IF o Usuário tentar criar uma Categoria com nome já existente (ignorando maiúsculas/minúsculas), THEN THE Sistema SHALL rejeitar a criação e exibir a mensagem: "Já existe uma categoria com este nome."
5. IF o Usuário tentar criar uma Categoria com nome vazio ou excedendo 50 caracteres, THEN THE Sistema SHALL rejeitar a criação e exibir uma mensagem de validação indicando o critério violado.
6. WHEN o Usuário acessa o Painel com transações categorizadas no mês selecionado, THE Sistema SHALL exibir um gráfico de distribuição de gastos por Categoria apresentando o valor absoluto e o percentual de cada Categoria em relação ao total de gastos do Usuário no período.
7. WHILE nenhuma transação categorizada existir para o mês selecionado, THE Sistema SHALL exibir o gráfico de distribuição vazio com a mensagem: "Nenhum dado disponível para o período."

---

### Requirement 4: Divisão de Gastos entre Pessoas

**User Story:** Como Usuário, quero marcar transações como pertencentes a Dependentes que usam meu cartão, para que eu saiba exatamente quanto cada pessoa gastou e possa cobrar os valores correspondentes.

#### Acceptance Criteria

1. WHEN o Usuário cadastra um Dependente com nome único (comparação sem distinção de maiúsculas/minúsculas) e com no máximo 50 caracteres, THE Sistema SHALL registrar o Dependente e torná-lo disponível para associação com Transações.
2. WHEN o Usuário associa uma Transação a um Dependente, THE Sistema SHALL registrar a associação, deduzir o valor da Transação do total de gastos do Usuário e atribuir esse valor ao subtotal do Dependente. Cada Transação pode ser associada a no máximo um Dependente por vez.
3. WHEN o Usuário acessa o Painel com Dependentes que possuem Transações associadas no mês selecionado, THE Sistema SHALL exibir para cada Dependente o subtotal das Transações associadas a ele no período.
4. WHEN o Usuário remove a associação entre uma Transação e um Dependente, THE Sistema SHALL desfazer a associação, restituir o valor da Transação ao total de gastos do Usuário e atualizar o subtotal do Dependente.
5. IF o Usuário tentar cadastrar um Dependente com nome já existente (ignorando maiúsculas/minúsculas), THEN THE Sistema SHALL rejeitar o cadastro e exibir uma mensagem indicando que já existe um dependente com esse nome.
6. IF o Usuário tentar cadastrar um Dependente com nome vazio ou excedendo 50 caracteres, THEN THE Sistema SHALL rejeitar o cadastro e exibir uma mensagem de validação indicando o critério violado.
7. WHILE um Dependente possuir Transações associadas, THE Sistema SHALL impedir a exclusão do Dependente e exibir uma mensagem informando que não é possível excluir um dependente com transações vinculadas.
8. IF o Usuário tentar reassociar uma Transação já vinculada a um Dependente para outro Dependente, THEN THE Sistema SHALL exibir uma confirmação informando que a Transação já possui um Dependente associado e solicitar confirmação antes de substituir a associação.
9. THE Sistema SHALL permitir no máximo 10 Dependentes por conta de Usuário.

---

### Requirement 5: Registro Manual de Gastos

**User Story:** Como Usuário, quero registrar gastos que não aparecem na fatura do cartão, para que minha visão financeira do mês seja completa e inclua despesas pagas em dinheiro ou débito.

#### Acceptance Criteria

1. WHEN o Usuário preenche os campos obrigatórios (data, descrição com no máximo 255 caracteres, valor entre R$ 0,01 e R$ 9.999.999,99 e categoria) e confirma o registro, THE Sistema SHALL persistir a Transação manual e exibi-la na listagem do mês correspondente à data informada.
2. IF o Usuário submeter o formulário de registro manual com algum campo obrigatório em branco, THEN THE Sistema SHALL destacar os campos ausentes, exibir uma mensagem solicitando o preenchimento dos campos obrigatórios e manter os dados já preenchidos nos demais campos.
3. IF o Usuário informar um valor fora do intervalo permitido (menor ou igual a zero, ou maior que R$ 9.999.999,99), THEN THE Sistema SHALL rejeitar o registro e exibir uma mensagem indicando o intervalo de valor aceito.
4. WHEN o Usuário edita uma Transação manual existente, as mesmas regras de validação dos critérios 1, 2 e 3 SHALL ser aplicadas. WHEN as alterações são confirmadas e válidas, THE Sistema SHALL atualizar os dados persistidos e refletir as alterações na listagem em até 1 segundo.
5. IF ocorrer falha de persistência ao criar ou editar uma Transação manual, THEN THE Sistema SHALL exibir uma mensagem de erro genérica e manter o formulário preenchido para que o Usuário possa tentar novamente sem redigitar os dados.
6. WHEN o Usuário solicita a exclusão de uma Transação manual, THE Sistema SHALL exibir uma confirmação solicitando que o Usuário confirme a ação antes de prosseguir. WHEN o Usuário confirma a exclusão, THE Sistema SHALL remover a Transação e recalcular os totais exibidos no Painel. IF o Usuário cancelar, THE Sistema SHALL manter a Transação inalterada.

---

### Requirement 6: Cadastro de Renda

**User Story:** Como Usuário, quero informar minha renda mensal, para que o sistema calcule meu saldo disponível e eu saiba quanto ainda tenho para gastar no mês.

#### Acceptance Criteria

1. WHEN o Usuário informa um valor de Renda no intervalo de R$ 0,01 a R$ 999.999.999,99 para um mês e confirma, THE Sistema SHALL persistir o valor, substituindo qualquer Renda previamente registrada para o mesmo mês, e exibi-lo no Painel do mês correspondente.
2. IF o Usuário informar um valor de Renda fora do intervalo permitido (menor ou igual a zero ou maior que R$ 999.999.999,99), THEN THE Sistema SHALL rejeitar o registro, exibir uma mensagem indicando o intervalo válido e manter o valor de Renda anteriormente registrado inalterado.
3. THE Painel SHALL exibir o saldo do mês calculado como: Renda − soma de todas as Despesas confirmadas do Usuário no mês (excluindo Transações associadas a Dependentes). IF não houver Despesas no mês, THEN o saldo exibido SHALL ser igual ao valor da Renda cadastrada.
4. WHEN o Usuário atualiza o valor da Renda de um mês, THE Sistema SHALL recalcular e atualizar o saldo exibido no Painel em até 1 segundo após a confirmação.
5. WHILE nenhuma Renda estiver cadastrada para o mês selecionado, THE Sistema SHALL exibir o saldo como "–" e apresentar a mensagem: "Informe sua renda para visualizar o saldo do mês."

---

### Requirement 7: Painel de Resumo Financeiro

**User Story:** Como Usuário, quero visualizar um resumo financeiro do mês no Painel, para que eu tenha uma visão consolidada da minha situação financeira sem precisar navegar por múltiplas telas.

#### Acceptance Criteria

1. WHEN o Usuário acessa o Painel, THE Sistema SHALL exibir por padrão os dados do mês corrente (mês e ano do calendário no momento do acesso) e apresentar: total de gastos do Usuário, subtotal por Dependente, saldo do mês (Renda − total de gastos do Usuário) e distribuição percentual de gastos por Categoria.
2. WHEN o Usuário seleciona um mês diferente no Painel, THE Sistema SHALL recarregar todos os indicadores financeiros com os dados do mês selecionado em até 2 segundos.
3. WHEN uma Transação é criada, editada ou excluída, ou quando a Renda é alterada, THE Sistema SHALL atualizar os indicadores financeiros do Painel afetados em até 1 segundo, sem necessidade de recarregar a página.
4. IF não houver dados financeiros para o mês selecionado, THEN THE Sistema SHALL exibir todos os indicadores numéricos com valor zero e a mensagem: "Nenhum dado encontrado para este período."
5. WHEN dados financeiros existirem para o mês selecionado, THE Sistema SHALL exibir os valores calculados reais em todos os indicadores, mesmo que esses valores resultem em zero.

---

### Requirement 8: Acesso Web e Autenticação

**User Story:** Como Usuário, quero acessar a aplicação de qualquer dispositivo via navegador web, para que eu possa consultar e atualizar meus dados financeiros em qualquer lugar.

#### Acceptance Criteria

1. THE Sistema SHALL ser acessível por navegador web (Chrome, Firefox, Edge e Safari em suas versões estáveis mais recentes) sem necessidade de instalação de software adicional.
2. WHEN o Usuário acessa qualquer rota da aplicação sem uma sessão ativa, THE Sistema SHALL redirecionar para a tela de autenticação e bloquear o acesso a todas as funcionalidades que envolvam dados financeiros do Usuário.
3. WHEN o Usuário fornece credenciais válidas (e-mail e senha), THE Sistema SHALL autenticar o Usuário e redirecionar para o Painel.
4. IF o Usuário fornecer credenciais inválidas, THEN THE Sistema SHALL exibir uma mensagem informando que o e-mail ou a senha estão incorretos, sem indicar qual dos dois campos está errado, e manter o Usuário na tela de autenticação.
5. THE Sistema SHALL manter a sessão ativa por no mínimo 8 horas e no máximo 24 horas sem interação do Usuário, invalidando-a automaticamente ao atingir o limite máximo.
6. WHEN o Usuário solicita o encerramento da sessão, THE Sistema SHALL invalidar a sessão imediatamente e redirecionar para a tela de autenticação.
7. THE Sistema SHALL garantir que os dados de um Usuário não sejam acessíveis por outro Usuário autenticado, aplicando controle de acesso baseado na identidade da sessão ativa em todas as operações de leitura e escrita.
8. IF o Usuário realizar 5 tentativas de autenticação consecutivas com credenciais inválidas, THEN THE Sistema SHALL bloquear novas tentativas de login para aquela conta por 15 minutos e exibir uma mensagem informando o bloqueio temporário e o tempo restante.
