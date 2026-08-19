# Implementation Plan: Controle Financeiro

## Overview

Implementação incremental da aplicação web de controle financeiro pessoal. A versão atual não possui autenticação — a aplicação opera com um único usuário implícito. A stack é: React 18 + TypeScript + Tailwind CSS + shadcn/ui + Recharts no frontend; Node.js + Fastify + TypeScript + Drizzle ORM no backend; PostgreSQL como banco de dados; PapaParse para parse de CSV no cliente; Vitest + fast-check para testes.

---

## Tasks

- [x] 1. Configurar estrutura do projeto monorepo
  - Criar estrutura de diretórios: `packages/backend`, `packages/frontend`, `packages/shared`
  - Inicializar `package.json` raiz com workspaces (npm workspaces), scripts `dev`, `build` e `test`
  - Configurar TypeScript (`tsconfig.json`) em cada pacote com paths compartilhados via `packages/shared`
  - Configurar Vitest como test runner global com suporte a fast-check
  - Criar `.env.example` com variáveis: `DATABASE_URL`, `PORT`
  - _Requirements: 8.1_

- [x] 2. Definir schema do banco de dados e migrations
  - [x] 2.1 Criar schema Drizzle ORM com todas as tabelas (`categories`, `dependents`, `transactions`, `imports`, `income`)
    - `categories`: id UUID PK, name VARCHAR(50), is_default BOOLEAN, UNIQUE(name) case-insensitive
    - `dependents`: id UUID PK, name VARCHAR(50) NOT NULL, UNIQUE(name) case-insensitive
    - `transactions`: id UUID PK, date DATE, description VARCHAR(255), amount BIGINT (centavos), category_id FK, dependent_id FK nullable, source VARCHAR(10) ('csv'|'manual'), import_id FK nullable, created_at, updated_at
    - `imports`: id UUID PK, reference_month VARCHAR(7) YYYY-MM UNIQUE, imported_at, transaction_count INT
    - `income`: id UUID PK, month VARCHAR(7) YYYY-MM UNIQUE, amount BIGINT (centavos)
    - Incluir índice funcional case-insensitive em `categories(name)` e `dependents(name)`
    - _Requirements: 1.2, 3.1, 4.1, 6.1_
  - [x] 2.2 Criar migration inicial e seed de categorias padrão
    - Gerar arquivo de migration com `drizzle-kit generate`
    - Inserir as 9 categorias padrão com `is_default = TRUE`: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Vestuário, Assinaturas, Outros
    - _Requirements: 3.1_

- [x] 3. Implementar módulo de categorias e dependentes (backend)
  - [x] 3.1 Implementar `CategoryService` com operações CRUD
    - `listCategories()`: retorna categorias padrão + personalizadas
    - `createCategory(name)`: valida unicidade case-insensitive, máx 50 chars; lança 409 se duplicado, 422 se inválido
    - `deleteCategory(id)`: permite deletar somente categorias não-padrão e sem transações vinculadas
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [x] 3.2 Implementar rotas de categorias
    - `GET /api/categories` — lista todas as categorias
    - `POST /api/categories` — cria categoria personalizada
    - `DELETE /api/categories/:id` — remove categoria personalizada
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [x] 3.3 Escrever teste de propriedade P6 — Unicidade case-insensitive de categorias
    - **Property 6: Unicidade case-insensitive de nomes de categoria e dependente**
    - **Validates: Requirements 3.3, 3.4**
    - Gerar variações de capitalização de nomes existentes via fast-check; verificar que todas são rejeitadas com erro de duplicidade
    - _Tag: `// Feature: controle-financeiro, Property 6: unicidade case-insensitive (categorias)`_
  - [x] 3.4 Implementar `DependentService` com operações CRUD
    - `listDependents()`: retorna todos os dependentes
    - `createDependent(name)`: valida unicidade case-insensitive, máx 50 chars, máx 10 dependentes; lança 409 se duplicado, 422 se inválido
    - `deleteDependent(id)`: somente se sem transações vinculadas
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 4.9_
  - [x] 3.5 Implementar rotas de dependentes
    - `GET /api/dependents` — lista dependentes
    - `POST /api/dependents` — cria dependente
    - `DELETE /api/dependents/:id` — remove dependente
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 4.9_
  - [x] 3.6 Escrever teste de propriedade P6 — Unicidade case-insensitive de dependentes
    - **Property 6: Unicidade case-insensitive de nomes de categoria e dependente**
    - **Validates: Requirements 4.1, 4.5**
    - Gerar variações de capitalização de nomes de dependentes via fast-check; verificar rejeição de duplicatas
    - _Tag: `// Feature: controle-financeiro, Property 6: unicidade case-insensitive (dependentes)`_

- [x] 4. Implementar módulo de transações (backend)
  - [x] 4.1 Implementar `TransactionService` — operações CRUD e listagem com filtros
    - `listTransactions({ month, categoryId, startDate, endDate, sort })`: retorna transações filtradas com total calculado
    - `createTransaction({ date, description, amount, categoryId })`: valida campos obrigatórios, amount em centavos (1–999999999)
    - `updateTransaction(id, data)`: mesmas validações do create
    - `deleteTransaction(id)`: remove a transação
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 5.1, 5.3, 5.4_
  - [x] 4.2 Implementar rotas de transações
    - `GET /api/transactions?month=&categoryId=&startDate=&endDate=&sort=` — listagem com filtros
    - `POST /api/transactions` — criação manual
    - `PUT /api/transactions/:id` — edição
    - `DELETE /api/transactions/:id` — exclusão
    - Retornar 422 para erros de validação com lista de campos
    - _Requirements: 2.1, 5.1, 5.2, 5.3, 5.4_
  - [x] 4.3 Implementar rota de associação de dependente
    - `PUT /api/transactions/:id/dependent` — body: `{ dependentId: string | null, force?: boolean }`
    - Retornar 409 com `{ requiresConfirmation: true }` quando transação já tem dependente e `force` não é true
    - Aceitar `dependentId: null` para desassociar
    - _Requirements: 4.2, 4.4, 4.8_
  - [x] 4.4 Escrever teste de propriedade P4 — Filtros preservam subconjunto e total corretos
    - **Property 4: Filtros de listagem preservam exatamente o subconjunto correto e seu total**
    - **Validates: Requirements 2.2, 2.3, 2.5**
    - Gerar transações e combinações de filtros aleatórios via fast-check; verificar subconjunto retornado e soma total
    - _Tag: `// Feature: controle-financeiro, Property 4: filtros preservam subconjunto e total`_
  - [x] 4.5 Escrever teste de propriedade P5 — Ordenação preserva o conjunto
    - **Property 5: Ordenação preserva o conjunto sem alterar os elementos**
    - **Validates: Requirements 2.7, 2.8**
    - Gerar lista de transações, ordenar por valor decrescente e por data mais recente; verificar mesmos elementos na ordem correta
    - _Tag: `// Feature: controle-financeiro, Property 5: ordenação preserva conjunto`_
  - [x] 4.6 Escrever teste de propriedade P7 — Invariante de particionamento financeiro
    - **Property 7: Invariante de particionamento financeiro (usuário + dependentes = total)**
    - **Validates: Requirements 4.2, 4.4**
    - Gerar conjuntos de transações com associações aleatórias; verificar `totalUsuário + somaDependentes == totalGeral`
    - _Tag: `// Feature: controle-financeiro, Property 7: invariante de particionamento financeiro`_
  - [x] 4.7 Escrever teste de propriedade P8 — Reversibilidade de desassociação
    - **Property 8: Desassociação de dependente é reversível**
    - **Validates: Requirements 4.4**
    - Gerar transação + dependente, associar, desassociar; verificar estado = estado anterior à associação
    - _Tag: `// Feature: controle-financeiro, Property 8: reversibilidade de desassociação`_

- [x] 5. Implementar módulo de renda e painel (backend)
  - [x] 5.1 Implementar `IncomeService` e rotas
    - `GET /api/income?month=YYYY-MM` — retorna renda do mês ou null
    - `PUT /api/income/:month` — cadastra ou substitui renda do mês; valida amount em centavos (1–99999999999)
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 5.2 Implementar `DashboardService` e rota `GET /api/dashboard?month=YYYY-MM`
    - Calcular e retornar: `totalUserExpenses` (transações sem dependent_id), `incomeAmount` (null se não cadastrado), `balance` (income - totalUserExpenses, null se sem renda), `expensesByCategory` (array com categoryId, categoryName, amount, percentage), `expensesByDependent` (array com dependentId, dependentName, amount)
    - _Requirements: 6.3, 7.1, 7.2, 7.4, 7.5_
  - [x] 5.3 Escrever teste de propriedade P9 — Saldo calculado corretamente
    - **Property 9: Saldo do painel é calculado corretamente para qualquer renda e gastos**
    - **Validates: Requirements 6.1, 6.3, 7.1**
    - Gerar renda e transações com e sem dependentes via fast-check; verificar `saldo == renda - gastosUsuário` incluindo edge cases (sem renda, sem transações, tudo em dependentes)
    - _Tag: `// Feature: controle-financeiro, Property 9: cálculo correto de saldo`_

- [x] 6. Implementar módulo de importação CSV (backend)
  - [x] 6.1 Implementar `ImportService` — persistência de importação
    - `checkDuplicate(referenceMonth)`: verifica se já existe importação para o mês
    - `saveImport({ referenceMonth, transactions })`: insere em batch dentro de BEGIN/COMMIT; calcula reference_month como mês da data mais antiga
    - `overwriteImport({ referenceMonth, transactions })`: deleta transações do período anterior e reinsere
    - _Requirements: 1.1, 1.2, 1.7_
  - [x] 6.2 Implementar rotas de importação
    - `POST /api/imports` — body: `{ transactions: Transaction[], force?: boolean }`; retorna 409 com `{ isDuplicate: true, referenceMonth }` se período já importado e `force` não é true
    - `GET /api/imports` — histórico de importações
    - Revalidar transações server-side (data, descrição, amount > 0)
    - _Requirements: 1.1, 1.7_
  - [x] 6.3 Escrever teste de propriedade P3 — Mês de referência = data mais antiga
    - **Property 3: O mês de referência da fatura é sempre o da data mais antiga**
    - **Validates: Requirements 1.2**
    - Gerar conjuntos aleatórios de datas via fast-check; verificar `referenceMonth == format(min(datas), 'YYYY-MM')`
    - _Tag: `// Feature: controle-financeiro, Property 3: mês de referência = data mais antiga`_

- [x] 7. Checkpoint — Backend completo
  - Executar `vitest --run` no pacote backend. Verificar que P3, P4, P5, P6, P7, P8, P9 passam e que todas as rotas retornam os status codes corretos.

- [x] 8. Implementar parser CSV no frontend
  - [x] 8.1 Implementar `parseCsv(file: File): Promise<CsvParseResult>` usando PapaParse
    - Suportar UTF-8 e UTF-8 com BOM
    - Detectar colunas `data`, `descrição`/`description`, `valor`/`value` independente da ordem no cabeçalho (case-insensitive)
    - Validar cada linha: data válida (YYYY-MM-DD ou DD/MM/YYYY), descrição não-vazia, valor numérico > 0
    - Converter valor para centavos (integer)
    - Retornar `{ valid: ParsedTransaction[], invalidCount: number, invalidReasons: Array<{ line: number, reason: string }> }`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.8, 1.9_
  - [x] 8.2 Escrever teste de propriedade P1 — Parser invariante à ordem de colunas e encoding
    - **Property 1: Parser CSV é invariante à ordem das colunas e à codificação**
    - **Validates: Requirements 1.8, 1.9**
    - Gerar registros CSV válidos, permutar ordens de colunas, encodar em UTF-8 e UTF-8+BOM; output deve ser idêntico
    - _Tag: `// Feature: controle-financeiro, Property 1: parser invariante à ordem e encoding`_
  - [x] 8.3 Escrever teste de propriedade P2 — Linhas válidas extraídas independente das inválidas
    - **Property 2: Linhas válidas são sempre extraídas, independente das inválidas**
    - **Validates: Requirements 1.4**
    - Gerar mix aleatório de linhas válidas e inválidas; verificar que `valid` == exatamente as linhas válidas
    - _Tag: `// Feature: controle-financeiro, Property 2: linhas válidas extraídas`_
  - [x] 8.4 Escrever testes unitários para casos de borda do parser
    - Arquivo vazio, todas as linhas inválidas, campo valor com vírgula decimal, datas em formatos mistos
    - _Requirements: 1.4, 1.5_

- [x] 9. Configurar frontend base (Vite + React + TanStack Query + React Router)
  - [x] 9.1 Configurar Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
    - Instalar e configurar dependências: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `axios`, `recharts`, `papaparse`
    - Configurar `tailwind.config.ts` e `postcss.config.js`
    - Inicializar shadcn/ui com `components.json`
    - _Requirements: 8.1_
  - [x] 9.2 Configurar Axios e TanStack Query
    - Configurar instância Axios com `baseURL` apontando para a API (`/api`)
    - Configurar `QueryClient` com `staleTime: 30000` e `retry: 1`
    - Criar hooks base: `useTransactions`, `useCategories`, `useDependents`, `useIncome`, `useDashboard`
    - _Requirements: 7.3_
  - [x] 9.3 Configurar roteamento com React Router v6
    - Definir rotas: `/` → `DashboardPage`, `/transactions` → `TransactionsPage`, `/import` → `ImportPage`, `/categories` → `CategoriesPage`, `/dependents` → `DependentsPage`
    - Criar layout base com sidebar de navegação
    - _Requirements: 8.1_

- [x] 10. Implementar `ImportPage` — upload e preview do CSV (frontend)
  - [x] 10.1 Criar componente de upload de arquivo com validação client-side
    - Rejeitar extensão diferente de `.csv` com mensagem "Formato inválido. Por favor, envie um arquivo CSV."
    - Rejeitar arquivos > 10 MB com mensagem "O arquivo excede o tamanho máximo permitido de 10 MB."
    - _Requirements: 1.3, 1.6_
  - [x] 10.2 Integrar `parseCsv` com exibição de preview e relatório de erros
    - Exibir tabela de preview com transações válidas (data, descrição, valor)
    - Exibir relatório de linhas ignoradas com número e motivos
    - Bloquear botão "Importar" se não houver linhas válidas
    - _Requirements: 1.1, 1.4, 1.5_
  - [x] 10.3 Implementar fluxo de envio e confirmação de duplicidade
    - Enviar `POST /api/imports` com as transações válidas
    - Ao receber 409 com `isDuplicate: true`, exibir modal de confirmação antes de reenviar com `force: true`
    - Ao cancelar, manter dados existentes e fechar modal
    - _Requirements: 1.7_
  - [x] 10.4 Escrever testes unitários para `ImportPage`
    - Testar: arquivo inválido (extensão, tamanho), preview de linhas válidas/inválidas, fluxo de duplicidade
    - _Requirements: 1.3, 1.4, 1.6, 1.7_

- [x] 11. Implementar `TransactionsPage` — listagem, filtros, ordenação e CRUD manual (frontend)
  - [x] 11.1 Criar `TransactionsPage` com tabela de transações e seletor de mês
    - Exibir colunas: data, descrição, valor, categoria, dependente
    - Exibir total das transações listadas abaixo da tabela
    - Exibir "Nenhuma transação encontrada para este período." quando lista vazia
    - _Requirements: 2.1, 2.6_
  - [x] 11.2 Implementar filtros de categoria e intervalo de datas
    - Recalcular total exibido a cada mudança de filtro
    - Ignorar silenciosamente filtro de datas quando início > fim ou datas inválidas
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - [x] 11.3 Implementar controles de ordenação (por valor decrescente e por data mais recente)
    - _Requirements: 2.7, 2.8_
  - [x] 11.4 Implementar formulário de criação e edição de transação manual (modal ou drawer)
    - Campos: data, descrição (max 255 chars), valor (R$ 0,01–9.999.999,99), categoria
    - Validação client-side: destacar campos inválidos em vermelho com mensagens inline
    - Manter dados preenchidos após erro de persistência (não limpar formulário)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 11.5 Implementar modal de confirmação de exclusão de transação
    - _Requirements: 5.6_
  - [x] 11.6 Implementar seletor de dependente em cada linha da tabela
    - Dropdown com lista de dependentes + opção "Nenhum"
    - Exibir modal de confirmação quando transação já tem dependente associado
    - _Requirements: 4.2, 4.4, 4.8_
  - [x] 11.7 Escrever testes unitários para filtros e total em `TransactionsPage`
    - Testar: filtro por categoria, filtro por data, combinação de filtros, recálculo de total
    - _Requirements: 2.2, 2.3, 2.5_

- [x] 12. Implementar `CategoriesPage` e `DependentsPage` (frontend)
  - [x] 12.1 Criar `CategoriesPage` com listagem e formulário de criação/exclusão
    - Exibir categorias padrão (badge "Padrão", sem botão de excluir) e personalizadas
    - Exibir "Já existe uma categoria com este nome." ao receber 409
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [x] 12.2 Criar `DependentsPage` com listagem e formulário de criação/exclusão
    - Impedir exclusão quando dependente tem transações vinculadas (exibir mensagem)
    - Exibir contador "X/10 dependentes"
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 4.9_

- [x] 13. Implementar `DashboardPage` — painel de resumo financeiro (frontend)
  - [x] 13.1 Criar cards de indicadores com seletor de mês
    - Card "Total de gastos" — soma das transações sem dependente
    - Card "Renda" — com formulário inline para cadastrar/atualizar; exibir "–" e mensagem quando sem renda
    - Card "Saldo" — renda − gastos; exibir "–" e mensagem quando sem renda
    - Exibir "Nenhum dado encontrado para este período." quando sem dados no mês
    - _Requirements: 6.3, 6.5, 7.1, 7.4, 7.5_
  - [x] 13.2 Criar gráfico de pizza (Recharts) para distribuição por categoria
    - Exibir valor absoluto (R$) e percentual por fatia
    - Exibir "Nenhum dado disponível para o período." quando vazio
    - _Requirements: 3.6, 3.7_
  - [x] 13.3 Criar lista de gastos por dependente
    - Exibir nome e subtotal de cada dependente com transações no mês
    - _Requirements: 4.3, 7.1_
  - [x] 13.4 Implementar formulário inline de renda no card "Renda"
    - Validar R$ 0,01 a R$ 999.999.999,99; exibir mensagem de erro inline
    - Invalidar query do dashboard após salvar (atualização reativa via TanStack Query)
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 13.5 Escrever testes unitários para cálculos do dashboard
    - Testar: saldo com e sem renda, saldo excluindo dependentes, percentuais por categoria
    - _Requirements: 6.3, 7.1_

- [x] 14. Checkpoint — Frontend completo
  - Executar `vitest --run` no pacote frontend. Verificar que P1 e P2 passam. Verificar renderização das páginas principais.

- [x] 15. Testes de integração
  - [x] 15.1 Implementar suite de integração: fluxo completo de importação CSV
    - Testar: POST /api/imports → GET /api/transactions → verificar transações persistidas
    - _Requirements: 1.1, 1.2, 1.7_
  - [x] 15.2 Implementar suite de integração: painel e renda
    - Testar: PUT /api/income → GET /api/dashboard → verificar saldo calculado; alterar transação → verificar atualização do saldo
    - _Requirements: 6.1, 6.3, 6.4, 7.1_

- [x] 16. Checkpoint final — Todos os testes passam
  - Executar `vitest --run` no monorepo inteiro. Verificar que todas as propriedades implementadas passam.

---

## Notes

- **Sem autenticação nesta versão** — aplicação single-user sem login; `user_id` removido de todas as tabelas
- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Valores monetários são manipulados em **centavos (inteiros)** internamente; conversão para reais apenas na camada de apresentação
- Testes PBT usam **fast-check** com mínimo de 100 iterações por propriedade
- Cada propriedade de corretude deve ter comentário `// Feature: controle-financeiro, Property N: <texto>`

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2"] },
    { "id": 2, "tasks": ["3.1", "3.4"] },
    { "id": 3, "tasks": ["3.2", "3.5"] },
    { "id": 4, "tasks": ["3.3", "3.6", "4.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "5.1", "6.2", "8.1"] },
    { "id": 6, "tasks": ["4.4", "4.5", "4.6", "4.7", "5.2", "6.3", "8.2", "8.3", "8.4", "9.1"] },
    { "id": 7, "tasks": ["5.3", "9.2", "9.3", "10.1"] },
    { "id": 8, "tasks": ["10.2", "11.1"] },
    { "id": 9, "tasks": ["10.3", "11.2", "11.3", "11.4", "12.1", "12.2"] },
    { "id": 10, "tasks": ["10.4", "11.5", "11.6", "11.7", "13.1"] },
    { "id": 11, "tasks": ["13.2", "13.3", "13.4"] },
    { "id": 12, "tasks": ["13.5", "15.1"] },
    { "id": 13, "tasks": ["15.2"] }
  ]
}
```
