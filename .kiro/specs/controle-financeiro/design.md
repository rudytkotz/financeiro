# Design Document — Controle Financeiro

## Overview

A aplicação **Controle Financeiro** é um sistema web de gestão financeira pessoal que permite ao usuário importar faturas de cartão de crédito em CSV, categorizar transações, dividir gastos entre dependentes, registrar lançamentos manuais e acompanhar sua situação financeira mensal por meio de um painel consolidado.

### Decisões de Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React 18 + TypeScript | Ecossistema maduro, tipagem estática, excelente suporte a componentes reativos |
| Estilo | Tailwind CSS + shadcn/ui | Design system consistente, zero CSS customizado em produção |
| Gráficos | Recharts | Biblioteca React-nativa, leve, acessível |
| Backend | Node.js + Fastify + TypeScript | Alta performance, schema validation nativa via JSON Schema |
| ORM | Drizzle ORM | Type-safe, migrations declarativas, queries SQL explícitas |
| Banco de dados | PostgreSQL | Confiabilidade, suporte a JSONB para metadados, transações ACID |
| Autenticação | JWT (access token 15 min + refresh token httpOnly) | Sessão stateless com renovação transparente |
| Parse CSV | PapaParse (browser) | Suporte a UTF-8, UTF-8 BOM, detecção de cabeçalho dinâmico |
| Testes unitários/PBT | Vitest + fast-check | Integração nativa com TypeScript, property-based testing |
| Build/Tooling | Vite | Build ultrarrápido, HMR eficiente |

### Contexto de Implantação

```
Usuário (navegador)
     │
     ▼
  Servidor Web (Nginx/Caddy)
     │ serve arquivos estáticos do frontend
     │ faz proxy das rotas /api/*
     ▼
  Backend API (Fastify)
     │
     ▼
  PostgreSQL
```

---

## Architecture

### Visão Geral das Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React SPA)                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Pages/Views │  │  Components  │  │  State (Zustand)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         └─────────────────┴────────────────────── ┤             │
│                                                    │ hooks       │
│  ┌─────────────────────────────────────────────────▼──────────┐ │
│  │  API Client Layer (TanStack Query + Axios)                 │ │
│  └────────────────────────────────────┬───────────────────────┘ │
└───────────────────────────────────────│─────────────────────────┘
                          HTTPS / REST  │
┌──────────────────────────────────────▼─────────────────────────┐
│  Backend API (Fastify)                                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │  Route Handlers │  │  Service Layer  │  │  Domain Logic    │ │
│  └────────┬───────┘  └────────┬────────┘  └──────┬───────────┘ │
│           │                   │                   │             │
│  ┌────────▼───────────────────▼───────────────────▼──────────┐ │
│  │  Repository Layer (Drizzle ORM)                            │ │
│  └────────────────────────────┬───────────────────────────────┘ │
└───────────────────────────────│─────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     PostgreSQL         │
                    └───────────────────────┘
```

### Fluxo de Autenticação

```
Browser ──POST /api/auth/login──► Fastify
                                     │ valida credenciais
                                     │ gera accessToken (JWT 15min)
                                     │ gera refreshToken (JWT 24h, httpOnly cookie)
                                     ◄─────────────────────────────
Browser (guarda accessToken em memória)

[requisição autenticada]
Browser ──GET /api/transactions ──► Fastify (verifica accessToken)
                                     ◄── dados ──────────────────

[accessToken expirado]
Browser ──POST /api/auth/refresh ──► Fastify (valida refreshToken cookie)
                                      ◄── novo accessToken ────────
```

### Fluxo de Importação CSV

```
Browser
  │ seleciona arquivo .csv
  │ PapaParse (client-side) faz parse
  │ valida linhas obrigatórias
  │ exibe preview + erros
  │ POST /api/imports (JSON com transações)
  ▼
Fastify ImportService
  │ valida período já importado?
  │   sim → retorna 409 Conflict
  │ persiste transações (batch insert)
  ▼
PostgreSQL
```

---

## Components and Interfaces

### Backend — Módulos

#### AuthModule
- `POST /api/auth/login` — autenticação por e-mail/senha
- `POST /api/auth/logout` — invalida sessão (blacklist do refreshToken)
- `POST /api/auth/refresh` — renova accessToken via cookie httpOnly
- Rate limiting: máximo 5 tentativas falhas → bloqueio de 15 min (armazenado em tabela `login_attempts`)

#### TransactionModule
- `GET /api/transactions?month=YYYY-MM&category=&startDate=&endDate=&sort=` — listagem com filtros
- `POST /api/transactions` — criação manual
- `PUT /api/transactions/:id` — edição
- `DELETE /api/transactions/:id` — exclusão (com confirmação no frontend)

#### ImportModule
- `POST /api/imports` — recebe payload JSON com transações pré-parseadas no cliente
- `GET /api/imports` — histórico de importações

#### CategoryModule
- `GET /api/categories` — lista categorias (padrão + personalizadas do usuário)
- `POST /api/categories` — cria categoria personalizada
- `DELETE /api/categories/:id` — remove categoria personalizada (apenas sem transações vinculadas)

#### DependentModule
- `GET /api/dependents` — lista dependentes
- `POST /api/dependents` — cadastra dependente
- `DELETE /api/dependents/:id` — remove dependente (apenas sem transações vinculadas)
- `PUT /api/transactions/:id/dependent` — associa/dissocia transação a dependente

#### IncomeModule
- `GET /api/income?month=YYYY-MM` — leitura da renda do mês
- `PUT /api/income/:month` — cadastra ou atualiza renda do mês

#### DashboardModule
- `GET /api/dashboard?month=YYYY-MM` — retorna todos os indicadores financeiros do mês em uma única chamada

### Frontend — Páginas e Componentes

| Página | Rota | Responsabilidade |
|---|---|---|
| LoginPage | `/login` | Formulário de autenticação |
| DashboardPage | `/` | Painel resumo financeiro |
| TransactionsPage | `/transactions` | Listagem, filtros, ordenação |
| ImportPage | `/import` | Upload CSV, preview, confirmação |
| CategoriesPage | `/categories` | Gerenciar categorias |
| DependentsPage | `/dependents` | Gerenciar dependentes |

### Interfaces TypeScript Principais

```typescript
// Domínio
interface Transaction {
  id: string;
  userId: string;
  date: string;           // ISO 8601 YYYY-MM-DD
  description: string;   // max 255 chars
  amount: number;        // positivo, centavos (integer)
  categoryId: string;
  dependentId: string | null;
  source: 'csv' | 'manual';
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  userId: string | null;  // null = categoria padrão do sistema
  name: string;           // max 50 chars
  isDefault: boolean;
}

interface Dependent {
  id: string;
  userId: string;
  name: string;           // max 50 chars
}

interface Income {
  id: string;
  userId: string;
  month: string;          // YYYY-MM
  amount: number;         // positivo, centavos (integer)
}

// Dashboard
interface DashboardSummary {
  month: string;
  totalUserExpenses: number;
  incomeAmount: number | null;
  balance: number | null;
  expensesByCategory: Array<{ categoryId: string; categoryName: string; amount: number; percentage: number }>;
  expensesByDependent: Array<{ dependentId: string; dependentName: string; amount: number }>;
}

// CSV Parse
interface CsvParseResult {
  valid: Transaction[];
  invalidCount: number;
  invalidReasons: string[];
}
```

---

## Data Models

### Diagrama Entidade-Relacionamento

```
users
  id            UUID PK
  email         VARCHAR(320) UNIQUE NOT NULL
  password_hash VARCHAR(255) NOT NULL
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

login_attempts
  id            UUID PK
  user_id       UUID FK → users.id
  attempted_at  TIMESTAMPTZ NOT NULL
  success       BOOLEAN NOT NULL

refresh_tokens
  id            UUID PK
  user_id       UUID FK → users.id
  token_hash    VARCHAR(255) NOT NULL
  expires_at    TIMESTAMPTZ NOT NULL
  revoked       BOOLEAN DEFAULT FALSE

categories
  id            UUID PK
  user_id       UUID FK → users.id  (NULL para categorias padrão)
  name          VARCHAR(50) NOT NULL
  is_default    BOOLEAN DEFAULT FALSE
  UNIQUE(user_id, name) -- case-insensitive via citext ou índice funcional

dependents
  id            UUID PK
  user_id       UUID FK → users.id
  name          VARCHAR(50) NOT NULL
  UNIQUE(user_id, name) -- case-insensitive

transactions
  id            UUID PK
  user_id       UUID FK → users.id
  date          DATE NOT NULL
  description   VARCHAR(255) NOT NULL
  amount        BIGINT NOT NULL          -- centavos, sempre positivo
  category_id   UUID FK → categories.id
  dependent_id  UUID FK → dependents.id (NULL se do usuário)
  source        VARCHAR(10) NOT NULL     -- 'csv' | 'manual'
  import_id     UUID FK → imports.id    (NULL se manual)
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

imports
  id            UUID PK
  user_id       UUID FK → users.id
  reference_month VARCHAR(7) NOT NULL    -- YYYY-MM
  imported_at   TIMESTAMPTZ NOT NULL
  transaction_count INT NOT NULL
  UNIQUE(user_id, reference_month)

income
  id            UUID PK
  user_id       UUID FK → users.id
  month         VARCHAR(7) NOT NULL      -- YYYY-MM
  amount        BIGINT NOT NULL          -- centavos
  UNIQUE(user_id, month)
```

### Valores Monetários

Todos os valores monetários são armazenados como **inteiros em centavos** para evitar erros de ponto flutuante. A conversão para/de reais ocorre exclusivamente na camada de apresentação.

### Mês de Referência da Fatura

O mês de referência de uma fatura importada é determinado pela **data mais antiga** entre todas as transações do arquivo CSV, formatado como `YYYY-MM`.

---

## Correctness Properties

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. As propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Property 1: Parser CSV é invariante à ordem das colunas e à codificação

*Para qualquer* arquivo CSV válido com colunas de data, descrição e valor em qualquer ordem, encodado em UTF-8 ou UTF-8 com BOM, o resultado do parse deve produzir o mesmo conjunto de transações que produziria com as colunas na ordem canônica e em UTF-8 puro.

**Validates: Requirements 1.8, 1.9**

---

### Property 2: Linhas válidas são sempre extraídas, independente das inválidas

*Para qualquer* arquivo CSV contendo uma mistura arbitrária de linhas válidas e inválidas, o conjunto de transações extraídas deve ser exatamente idêntico ao conjunto que seria extraído se o arquivo contivesse apenas as linhas válidas — nem mais, nem menos.

**Validates: Requirements 1.4**

---

### Property 3: O mês de referência da fatura é sempre o da data mais antiga

*Para qualquer* conjunto não-vazio de transações em um arquivo CSV, o mês de referência determinado pelo sistema deve ser igual ao mês e ano da transação com a data mais antiga do arquivo.

**Validates: Requirements 1.2**

---

### Property 4: Filtros de listagem preservam exatamente o subconjunto correto e seu total

*Para qualquer* lista de transações e qualquer combinação de filtros ativos (categoria, intervalo de datas), o resultado deve conter exatamente as transações que satisfazem todos os critérios ativos, e o total exibido deve ser exatamente igual à soma dos valores dessas transações.

**Validates: Requirements 2.2, 2.3, 2.5**

---

### Property 5: Ordenação preserva o conjunto sem alterar os elementos

*Para qualquer* lista de transações e qualquer critério de ordenação (valor decrescente ou data mais recente), a lista ordenada deve conter os mesmos elementos da lista original, reordenados corretamente segundo o critério aplicado.

**Validates: Requirements 2.7, 2.8**

---

### Property 6: Unicidade case-insensitive de nomes de categoria e dependente

*Para qualquer* par de nomes onde um é variação de maiúsculas/minúsculas do outro — seja de categorias ou de dependentes — o sistema deve rejeitar o segundo nome como duplicado, independentemente da capitalização específica usada.

**Validates: Requirements 3.3, 3.4, 4.1, 4.5**

---

### Property 7: Invariante de particionamento financeiro (usuário + dependentes = total)

*Para qualquer* conjunto de transações de um mês com qualquer combinação de associações a dependentes, a soma dos gastos do usuário mais a soma dos subtotais de todos os dependentes deve ser igual ao valor total de todas as transações do período.

**Validates: Requirements 4.2, 4.4**

---

### Property 8: Desassociação de dependente é reversível

*Para qualquer* transação associada a um dependente, remover a associação deve restaurar exatamente o estado anterior à associação — o valor da transação retorna ao total do usuário e o subtotal do dependente é reduzido pelo mesmo valor.

**Validates: Requirements 4.4**

---

### Property 9: Saldo do painel é calculado corretamente para qualquer renda e gastos

*Para qualquer* valor de renda e qualquer conjunto de transações de um mês (incluindo casos sem renda, sem transações ou com todos os gastos atribuídos a dependentes), o saldo exibido no painel deve ser exatamente igual à renda menos a soma das transações do próprio usuário (excluindo transações de dependentes).

**Validates: Requirements 6.1, 6.3, 7.1**

---

### Property 10: Isolamento de dados entre usuários

*Para quaisquer* dois usuários distintos autenticados, nenhuma operação de leitura de um usuário deve retornar dados pertencentes ao outro usuário — independentemente do tipo de dado (transações, categorias, dependentes, renda ou painel).

**Validates: Requirements 8.7**

---

### Property 11: Rotas protegidas redirecionam para autenticação sem sessão ativa

*Para qualquer* rota da aplicação que envolva dados financeiros, acessá-la sem uma sessão ativa deve sempre resultar em redirecionamento para a tela de autenticação.

**Validates: Requirements 8.2**

---

### Reflexão sobre Redundância

Após revisão cuidadosa:

- **Propriedades 7 e 8** são complementares — a Propriedade 7 verifica o invariante de soma total; a Propriedade 8 verifica a reversibilidade da operação de desassociação. Ambas são necessárias porque a 8 garante que operações individuais de desfazer funcionam corretamente, enquanto a 7 garante que o sistema global mantém o invariante.
- **Propriedades 1 e 2** foram separadas: a P1 cobre invariâncias do parser (ordem de colunas + encoding); a P2 cobre o comportamento de filtragem de linhas inválidas. São logicamente independentes.
- **Propriedade 6** consolidou as regras de unicidade de categorias (3.3/3.4) e dependentes (4.1/4.5) em uma única propriedade, pois ambas expressam a mesma invariante de unicidade case-insensitive aplicada à mesma lógica de comparação de nomes.
- **Propriedade 4** consolidou filtros (P3 original) e totais (P4 original) em uma única propriedade, eliminando redundância — o total filtrado é uma consequência direta do subconjunto filtrado.
- **Propriedade 5** consolidou os dois critérios de ordenação (por valor e por data), pois ambos testam a mesma invariante: "ordenação preserva o conjunto".

---

## Error Handling

### Estratégia Geral

| Cenário | Código HTTP | Comportamento |
|---|---|---|
| Credenciais inválidas | 401 | Mensagem genérica, sem indicar qual campo |
| Conta bloqueada (5 tentativas) | 429 | Mensagem com tempo restante |
| Sessão expirada / token inválido | 401 | Redirect para login no frontend |
| Recurso não encontrado | 404 | Mensagem padrão |
| Conflito (fatura duplicada, categoria duplicada) | 409 | Mensagem específica |
| Validação de entrada | 422 | Lista de campos e erros |
| Erro de persistência | 500 | Mensagem genérica, log interno |
| Arquivo muito grande (>10 MB) | 413 | Mensagem de tamanho excedido |
| Arquivo com formato inválido | 422 | Mensagem de formato inválido |

### Tratamento de Erros no CSV

O parse do CSV ocorre inteiramente no **lado do cliente** (PapaParse) antes de qualquer requisição ao servidor. Isso permite:

1. Validação instantânea sem custo de rede
2. Exibição de preview das transações e relatório de erros antes do envio
3. O servidor recebe apenas o payload JSON pré-validado — revalidação server-side é feita por segurança

### Transações de Banco de Dados

- Operações de importação usam `BEGIN / COMMIT` para garantir atomicidade
- Falhas de persistência fazem `ROLLBACK` completo
- Operações de atualização de saldo (associate/dissociate dependente) usam transações para manter o invariante da Propriedade 6

### Frontend — Tratamento de Erros

- Erros de rede: exibidos via toast notification
- Erros de validação (422): campos destacados em vermelho com mensagem inline
- Erro 500: mensagem genérica "Ocorreu um erro. Tente novamente."
- Formulários mantêm os dados preenchidos após erro para evitar redigitação

---

## Testing Strategy

### Abordagem Dual de Testes

A estratégia combina **testes de unidade/integração** para cenários específicos e **testes baseados em propriedades (PBT)** para verificar invariantes universais.

#### Testes Unitários (Vitest)

Focados em:
- Lógica de validação de campos (valor monetário, tamanho de nome, formato de data)
- Cálculos do painel (saldo, totais por categoria)
- Transformações de dados (CSV row → Transaction)
- Casos de borda e condições de erro explícitas (arquivo corrompido, todas as linhas inválidas)
- Exemplos de autenticação (login bem-sucedido, bloqueio por tentativas)

#### Testes Baseados em Propriedades (fast-check + Vitest)

Biblioteca: **fast-check** — suporta geração arbitrária de tipos complexos, shrinking automático, integração nativa com Vitest.

Configuração: mínimo **100 iterações** por propriedade (padrão do fast-check é 100 runs).

Cada propriedade é identificada com um comentário de tag no código:

```
// Feature: controle-financeiro, Property N: <texto da propriedade>
```

| Propriedade | Tipo de Teste | Estratégia |
|---|---|---|
| P1: Parser invariante à ordem de colunas e encoding | PBT | Gerar registros CSV válidos, permutar colunas, encodar em UTF-8/UTF-8+BOM, comparar output |
| P2: Linhas válidas extraídas independente das inválidas | PBT | Gerar mix aleatório de linhas válidas/inválidas, verificar que conjunto extraído == apenas as válidas |
| P3: Mês de referência = data mais antiga | PBT | Gerar conjuntos aleatórios de datas, verificar que referência == min(datas) |
| P4: Filtros preservam subconjunto e total corretos | PBT | Gerar transações e combinações de filtros aleatórios, verificar subconjunto e soma |
| P5: Ordenação preserva o conjunto | PBT | Gerar lista de transações, ordenar, verificar mesmos elementos em ordem correta |
| P6: Unicidade case-insensitive (categorias e dependentes) | PBT | Gerar variações de capitalização de nomes existentes, verificar rejeição de duplicatas |
| P7: Invariante de particionamento financeiro | PBT | Gerar transações e associações aleatórias, verificar totalUsuário + somaDependentes == total |
| P8: Reversibilidade de desassociação de dependente | PBT | Gerar transação + dependente, associar/desassociar, verificar estado = estado original |
| P9: Cálculo de saldo do painel | PBT | Gerar renda e transações aleatórias com/sem dependentes, verificar saldo == renda - gastosUsuário |
| P10: Isolamento de dados entre usuários | PBT | Gerar dois usuários com dados distintos, verificar que queries de um não retornam dados do outro |
| P11: Rotas protegidas redirecionam sem sessão | PBT | Gerar rotas protegidas aleatórias, verificar redirecionamento sem sessão ativa |

#### Testes de Integração

Executados contra um banco PostgreSQL de teste (Docker):
- Fluxo completo de importação CSV → persistência → listagem
- Autenticação: login, refresh, logout, bloqueio por tentativas
- Operações CRUD de transações manuais
- Cálculo do painel com dados reais no banco

#### Testes de Smoke (Acessibilidade e Compatibilidade)

- Verificar que a aplicação carrega nos 4 navegadores alvo (Chrome, Firefox, Edge, Safari)
- Verificar que rotas protegidas redirecionam para login sem sessão ativa

### Cobertura Esperada

| Módulo | Cobertura Mínima Alvo |
|---|---|
| Parser CSV (lógica pura) | 95% |
| Serviços de domínio (cálculos) | 90% |
| Route handlers | 80% |
| Componentes React críticos | 75% |
