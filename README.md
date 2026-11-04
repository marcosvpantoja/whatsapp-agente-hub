# WhatsApp Agente Hub

Plataforma SaaS multiempresa para gestão de salas e reservas pelo WhatsApp. Cada cliente conecta o próprio número, cadastra suas salas e recebe reservas, enquanto a área master acompanha todos os clientes e o suporte.

## Funcionalidades

**Área do cliente**
- Dashboard com o resumo de salas, reservas e chamados
- Cadastro de salas e calendário de reservas
- Conexão do WhatsApp por **QR Code** via [Evolution API](https://github.com/EvolutionAPI/evolution-api), com conectar e desconectar pelo painel
- Abertura de chamados de suporte com anexos
- Configurações da conta, com credenciais de integração guardadas criptografadas

**Área master (administração)**
- Dashboard geral da plataforma
- Gestão de clientes e usuários de suporte, com perfil de cada cliente
- Atendimento dos chamados de todos os clientes

**API de integração**
- Endpoints protegidos por chave para que o agente de IA no WhatsApp e outras automações listem agendas, verifiquem disponibilidade e criem, alterem, consultem ou cancelem reservas, com log de auditoria

## Segurança

- Sessão em cookie HTTP-only com token opaco persistido no banco (`auth_sessions`)
- Senhas com bcrypt e troca obrigatória no primeiro acesso
- Segredos de integração criptografados com AES-256-GCM
- Helmet e rate limiting na API

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query + Framer Motion
- **Backend:** Node.js + Express + TypeScript
- **Banco:** MySQL (mysql2)
- **Integrações:** Evolution API (WhatsApp) e Nodemailer (e-mail)

## Variáveis de ambiente

O projeto usa `.env` para tudo que e sensível ou configuravel em runtime.

Arquivo base: `.env.example`

Variaveis:

- `APP_HOST`: host de bind do servidor. Em Linux para rede local, use `0.0.0.0`
- `APP_PORT`: porta do frontend Vite. Padrão do projeto: `3008`
- `API_PORT`: porta interna da API Express. Padrão: `3009`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_SECURE`: define se o cookie de sessão exige HTTPS. Para acesso via IP/HTTP em rede local, use `false`
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
- os clientes mock antigos são importados para o banco
- as senhas são hashadas com `bcrypt`

## Comandos

Instalar dependências:

```bash
npm install
```

Rodar frontend + API em desenvolvimento:

```bash
npm run dev
```

Frontend: `http://localhost:3008`

Rodar a aplicação completa em modo de produção:

```bash
npm run start
```

Nesse modo:

- o frontend e servido pelo Express
- a API e servida pelo mesmo processo
- a aplicação responde pela porta `APP_PORT`

Build do frontend:

```bash
npm run build
```

Rodar somente a API:

```bash
npm run start:api
```

## Validação

Os seguintes comandos passaram após a migração para MySQL:

```bash
npm test
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.server.json --noEmit
npm run build
```

---

Desenvolvido por **Marcos Pantoja** · [29Tech](https://www.vintenove.com)
