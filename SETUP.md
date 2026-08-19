# Guia de Setup — Controle Financeiro

## Pré-requisitos

- **Node.js 18+** (recomendado: 20 LTS)
- **PostgreSQL 13+** (local ou na nuvem)
- **npm** (vem com o Node.js)

---

## 1. Instalar PostgreSQL

### Opção A: Local no Windows (mais rápido para testar)

1. Baixe o instalador: https://www.postgresql.org/download/windows/
2. Instale com a senha que quiser para o usuário `postgres`
3. Abra o pgAdmin ou o terminal `psql` e crie o banco:

```sql
CREATE DATABASE controle_financeiro;
```

### Opção B: Docker (se já tiver Docker instalado)

```bash
docker run -d \
  --name financeiro-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=controle_financeiro \
  -p 5432:5432 \
  postgres:16
```

### Opção C: Nuvem (para acessar de qualquer lugar)

Serviços com tier gratuito:
- **Neon** (https://neon.tech) — 0,5 GB grátis, sem cartão
- **Supabase** (https://supabase.com) — 500 MB grátis
- **Render** (https://render.com) — PostgreSQL gratuito por 90 dias

Após criar o banco, copie a **connection string** (formato: `postgresql://user:password@host:5432/controle_financeiro`).

---

## 2. Configurar variáveis de ambiente

Na raiz do projeto, crie o arquivo `.env`:

```bash
cp .env.example .env
```

Edite o `.env` com seus dados:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/controle_financeiro
PORT=3000
```

Se usar Neon/Supabase, a URL será algo como:
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/controle_financeiro?sslmode=require
```

---

## 3. Instalar dependências

```bash
cd c:\Users\Administrador\Desktop\Financeiro\financeiro
npm install
```

---

## 4. Criar as tabelas no banco

```bash
cd packages/backend
npx tsx src/db/migrate.ts
```

Se der erro com o migrator do Drizzle, rode o SQL manualmente:
- Abra `packages/backend/drizzle/0000_initial_schema.sql` no pgAdmin ou psql e execute

---

## 5. Inserir categorias padrão

```bash
npx tsx src/db/seed.ts
```

Isso cria as 9 categorias: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Vestuário, Assinaturas, Outros.

---

## 6. Rodar em desenvolvimento

Volte para a raiz do projeto:

```bash
cd ../..
npm run dev
```

Isso inicia:
- **Backend** na porta 3000 (API)
- **Frontend** na porta 5173 (interface web)

Acesse: **http://localhost:5173**

---

## 7. Deploy para acessar de qualquer lugar

### Opção A: Render.com (mais simples, gratuito)

1. Suba o código para um repositório Git (GitHub)
2. No Render, crie:
   - **Web Service** → apontar para o repo, comando de build: `npm install && npm run build`, start: `node packages/backend/dist/server.js`
   - **PostgreSQL** → banco gerenciado gratuito
   - Configure a variável `DATABASE_URL` com a connection string do banco Render
3. O frontend pode ser servido como arquivos estáticos pelo próprio Fastify (precisa de pequena adaptação) ou como um **Static Site** separado no Render

### Opção B: Railway.app

1. Conecte seu GitHub
2. Railway detecta o monorepo automaticamente
3. Adicione um serviço PostgreSQL
4. Deploy automático

### Opção C: VPS (mais controle)

1. Alugue um VPS (DigitalOcean, Contabo, Hetzner — a partir de $4/mês)
2. Instale Node.js 20 e PostgreSQL
3. Clone o repo, configure `.env`, rode migrations e build
4. Use `pm2` ou `systemd` para manter o backend rodando
5. Use Nginx como reverse proxy + SSL com Let's Encrypt

---

## Resumo dos comandos

```bash
# 1. Instalar
npm install

# 2. Configurar banco (após criar o .env)
cd packages/backend
npx tsx src/db/migrate.ts
npx tsx src/db/seed.ts
cd ../..

# 3. Rodar
npm run dev

# Acessar
# http://localhost:5173
```

---

## Estrutura do projeto

```
financeiro/
├── packages/
│   ├── backend/          # API Fastify + Drizzle ORM
│   │   ├── src/
│   │   │   ├── db/       # Schema, migrations, seed
│   │   │   ├── routes/   # Rotas REST
│   │   │   └── services/ # Lógica de negócio
│   │   └── drizzle/      # SQL de migrations
│   ├── frontend/         # React + Tailwind + Recharts
│   │   └── src/
│   │       ├── pages/    # DashboardPage, TransactionsPage, etc.
│   │       ├── components/
│   │       ├── hooks/    # useTransactions, useDashboard, etc.
│   │       └── lib/      # parseCsv, api, utils
│   └── shared/           # Tipos TypeScript compartilhados
├── .env.example
├── package.json
└── SETUP.md              # Este arquivo
```
