# WhatsAppAgentHub

Painel full-stack para gerenciamento de salas, reservas via WhatsApp, configuracoes e chamados, com area administrativa master.

## Stack

- Frontend: React + Vite + TypeScript + shadcn/ui
- Backend: Express + TypeScript
- Banco: MySQL
- Autenticacao: sessao segura em cookie HTTP-only com token opaco persistido em `auth_sessions`

## Variaveis de ambiente

O projeto usa `.env` para tudo que e sensivel ou configuravel em runtime.

Arquivo base: `.env.example`

Variaveis:

- `APP_HOST`: host de bind do servidor. Em Linux para rede local, use `0.0.0.0`
- `APP_PORT`: porta do frontend Vite. Padrao do projeto: `3008`
- `API_PORT`: porta interna da API Express. Padrao: `3009`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_SECURE`: define se o cookie de sessao exige HTTPS. Para acesso via IP/HTTP em rede local, use `false`
- `SESSION_TTL_DAYS`
- `SETTINGS_ENCRYPTION_KEY`
- `INTEGRATION_API_KEY`
- `EVOLUTION_HOST`
- `EVOLUTION_INSTANCE`
- `EVOLUTION_API_KEY`
- `SEED_ON_STARTUP`
- `SEED_MASTER_PASSWORD`
- `SEED_DEFAULT_CLIENT_PASSWORD`

## Banco

Antes de rodar, a estrutura MySQL precisa existir na database `vintenove_wahub`.

O backend faz seed inicial apenas se:

- `SEED_ON_STARTUP=true`
- a tabela `users` estiver vazia
- `SEED_MASTER_PASSWORD` e `SEED_DEFAULT_CLIENT_PASSWORD` estiverem preenchidas

Nesse seed:

- o master usa o e-mail `admin@syntra.com`
- os clientes mock antigos sao importados para o banco
- as senhas sao hashadas com `bcrypt`

## Comandos

Instalar dependencias:

```bash
npm install
```

Rodar frontend + API em desenvolvimento:

```bash
npm run dev
```

Frontend: `http://localhost:3008`

Rodar a aplicacao completa em modo de producao:

```bash
npm run start
```

Nesse modo:

- o frontend e servido pelo Express
- a API e servida pelo mesmo processo
- a aplicacao responde pela porta `APP_PORT`

Build do frontend:

```bash
npm run build
```

Rodar somente a API:

```bash
npm run start:api
```

## Validacao executada

Os seguintes comandos passaram apos a migracao:

```bash
npm test
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
npm run build
```
