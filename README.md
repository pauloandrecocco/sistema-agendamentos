# Sistema de Agendamentos

Aplicação web full stack para agendamento de atendimentos com dois papéis:

- **Cliente** — consulta dias e horários livres (sem login), agenda, acompanha e cancela os próprios agendamentos.
- **Administrador** — vê resumo, calendário com contagens e lista de agendamentos, cancela agendamentos, configura a agenda (duração e horário semanal) e bloqueia dias.

O documento-fonte do projeto, com todas as regras de negócio, a API e o modelo de dados, é o [`PRD.md`](PRD.md).

## Pré-requisitos

- **Docker** com **Docker Compose** (v2, comando `docker compose`): é tudo o que se precisa para rodar a aplicação.
- **Node.js 24** (com npm): apenas para desenvolver ou rodar testes fora do Docker.

## Como rodar (Docker)

```bash
docker compose up --build
```

Acesse **http://localhost:3000**. Não é preciso criar `.env`: todas as variáveis do Compose têm padrão. Na subida, a API aplica as migrations e roda o seed (idempotente).

| Serviço | Imagem                                                       | Porta no host                               |
| ------- | ------------------------------------------------------------ | ------------------------------------------- |
| `web`   | build do Vite servido por nginx (proxy de `/api` para a API) | `3000` (`WEB_PORT`)                         |
| `api`   | Express + Prisma                                             | `3333` (`API_PORT`), exposta para depuração |
| `db`    | `postgres:17-alpine`, volume `pgdata`                        | `5432` (`DB_PORT`)                          |

Para mudar portas ou credenciais, copie `.env.example` para `.env` e ajuste. Para zerar o banco (os dados ficam no volume `pgdata`):

```bash
docker compose down -v
```

## Como rodar (local, fora do Docker)

```bash
docker compose up db        # só o banco
cp .env.example .env        # DATABASE_URL e JWT_SECRET são obrigatórias fora do Docker
npm install
npm run db:deploy -w api    # aplica as migrations
npm run db:seed -w api      # usuários, configuração e agendamentos de exemplo
npm run dev                 # shared (watch) + api (porta API_PORT, padrão 3333) + web (5173)
```

Acesse **http://localhost:5173**; o Vite faz proxy de `/api` para `http://localhost:${API_PORT}`.

### Comandos úteis

| Comando                                       | O que faz                                                       |
| --------------------------------------------- | --------------------------------------------------------------- |
| `npm test`                                    | testes de todos os workspaces                                   |
| `npm run test -w api` / `npm run test -w web` | testes só do backend / só do frontend                           |
| `npm run lint`                                | ESLint + Prettier (verificação)                                 |
| `npm run typecheck`                           | TypeScript em todos os workspaces                               |
| `npm run build`                               | build de todos os workspaces                                    |
| `npm run db:migrate -w api -- --name <nome>`  | cria/aplica migration em desenvolvimento (`prisma migrate dev`) |
| `npm run db:seed -w api`                      | seed idempotente                                                |
| `npm run check:concurrency -w api`            | verificação manual de concorrência (ver abaixo)                 |

## Credenciais do seed

| Papel                 | E-mail             | Senha        |
| --------------------- | ------------------ | ------------ |
| Administrador         | `admin@agenda.com` | `admin123`   |
| Cliente (Maria Silva) | `maria@email.com`  | `cliente123` |
| Cliente (João Souza)  | `joao@email.com`   | `cliente123` |

O seed também cria a configuração padrão (slots de 30 min; seg–sex 09:00–18:00; sáb 09:00–13:00; dom fechado) e agendamentos de exemplo relativos à data atual (passados, futuros e cancelados). Ele pode rodar repetidamente: não duplica usuários, não sobrescreve a configuração e só cria exemplos se a tabela de agendamentos estiver vazia.

## Roteiro de demonstração

1. Em `/agendar`, sem login, escolha um dia disponível e um horário: você é levado ao login.
2. Entre como **Maria** (`maria@email.com` / `cliente123`): você volta para o mesmo horário com a confirmação aberta. Confirme.
3. Em **Meus agendamentos**, o novo agendamento aparece em _Próximos_.
4. Saia e entre como **admin** (`admin@agenda.com` / `admin123`): veja o resumo e, na aba **Agenda**, o calendário com as contagens do dia.
5. Ative **Gerenciar bloqueios**, selecione o dia do agendamento de Maria (clique, ou clique e arraste para vários dias), clique em **Bloquear** e confirme: o diálogo avisa quantos agendamentos confirmados serão cancelados.
6. Saia e entre de novo como **Maria**: no _Histórico_, o agendamento aparece como **"Cancelado pelo estabelecimento"**, e o dia bloqueado não oferece mais horários.

## Arquitetura

Monorepo com npm workspaces, TypeScript `strict` em tudo:

```
apps/api         Express 5 + Prisma 7 (driver adapter pg) + PostgreSQL 17
apps/web         React + Vite + Tailwind + shadcn/ui; nginx no Docker
packages/shared  schemas Zod, enums, tipos de DTO e helpers de data/status (usado pelos dois)
```

**Backend.** Cada módulo (`auth`, `availability`, `appointments`, `schedule`, `admin`) segue `routes → controller → service → repository`. Regras de negócio ficam nos services; validação de formato nos schemas Zod do `shared`. Repositórios são interfaces com implementação Prisma e implementação em memória; o app é montado por `createApp(deps)`, o que permite testar as rotas sem banco.

- **Disponibilidade:** `availability.engine.ts` é um conjunto de funções puras (configuração, bloqueios, agendamentos e `now` entram como parâmetros). A mesma função que gera os horários exibidos valida a reserva.
- **Consistência:** reserva e bloqueio rodam em `TransactionManager.run`, que adquire um `pg_advisory_xact_lock`. Além da validação no service, o banco tem a exclusion constraint `appointments_no_overlap` (sobreposição de intervalos `[start, end)` entre agendamentos confirmados), criada em migration SQL manual. A violação (SQLSTATE `23P01`) é convertida em `409 SLOT_ALREADY_BOOKED` em um único ponto (`lib/prisma-errors.ts`).
- **Erros:** todas as respostas de erro seguem `{ error: { code, message, details? } }`, com mensagens em pt-BR e sem stack trace.
- **Auth:** JWT em cookie httpOnly (`access_token`); senhas com `bcryptjs`. O cadastro sempre cria `CLIENT`; o admin vem do seed.
- **Tempo:** instantes em `timestamptz` (UTC) no banco e ISO UTC na API; todo agrupamento por dia usa o fuso de negócio fixo `America/Sao_Paulo`.

**Frontend.** React Router com guardas por papel, estado do servidor via TanStack Query, formulários com React Hook Form + resolver Zod do `shared`, toasts com sonner. O calendário (`MonthCalendar`) é próprio, sobre date-fns, e é usado em `/agendar` (seleção simples) e no painel do admin (seleção múltipla com arraste). No Docker, o nginx serve o build e faz proxy de `/api`: front e API ficam na mesma origem, sem CORS.

## Principais decisões

Resumo da seção 16 do PRD:

| Decisão                                                                             | Por quê                                                                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Agenda única com slots fixos configuráveis (30/60 min)                              | Atende o caso com mínima complexidade; o modelo guarda `start_at`/`end_at`, então mudar a duração não quebra nada |
| Disponibilidade calculada sob demanda                                               | Não há slots materializados para sincronizar; mudanças de configuração valem na hora                              |
| A mesma função gera os slots e valida a reserva                                     | Fonte única de verdade: impossível consultar uma regra e validar outra                                            |
| Conflito por sobreposição de intervalos, não por igualdade de início                | Continua correto quando a duração muda (ex.: 30 → 60)                                                             |
| Duas camadas contra conflito: validação + exclusion constraint                      | A aplicação dá mensagens claras; o banco garante mesmo sob concorrência                                           |
| Advisory lock em reserva e bloqueio                                                 | Fecha a corrida "reservar enquanto bloqueia", que a constraint não cobre                                          |
| Status persistido mínimo (`CONFIRMED`/`CANCELLED`); "Concluído" derivado do horário | Sem jobs para atualizar status                                                                                    |
| Cancelamento muda o estado, nunca apaga                                             | Histórico preservado, com quem cancelou e quando                                                                  |
| UTC no banco + fuso de negócio fixo                                                 | Instantes inequívocos; dias agrupados corretamente (inclusive após 21:00 em São Paulo)                            |
| Horários de configuração como texto `HH:mm`                                         | Legível ponta a ponta; evita o tipo `TIME` no Prisma                                                              |
| Navegação pública, login só para confirmar                                          | O visitante vê a agenda; "meus agendamentos" exige identidade                                                     |
| JWT em cookie httpOnly                                                              | Token inacessível a JavaScript; front mais simples                                                                |
| Monorepo com pacote `shared` (Zod)                                                  | Mesma validação no front e no back                                                                                |
| Módulos por domínio + injeção de dependências                                       | Organização clara; testes com repositórios em memória                                                             |
| Prisma                                                                              | Tipagem, migrations e seed integrados; a constraint especial vai em SQL de migration                              |
| nginx servindo o front e fazendo proxy da API                                       | Mesma origem: sem CORS, cookies simples                                                                           |
| Calendário próprio reutilizado em 2 telas                                           | Evita biblioteca pesada e atende a seleção por arraste                                                            |
| Bloquear dia cancela os agendamentos (com confirmação); mudar o horário semanal não | Bloqueio é ação explícita sobre datas; horário semanal é regra genérica                                           |
| Admin não agenda                                                                    | Pelo enunciado, quem agenda é o cliente; o admin recebe e gerencia                                                |

## Testes

- **Engine de disponibilidade:** testes unitários das funções puras, com `now` sempre injetado (dias fechados/bloqueados, alinhamento, mudança de duração, fuso, estados do mês).
- **Rotas e services:** Vitest + Supertest sobre `createApp` com repositórios em memória (auth, agendamento, cancelamento, permissões, bloqueio, configuração, formato de erro), incluindo a conversão do erro da constraint simulado pelo fake.
- **Frontend:** testes da lógica pura (formatação no fuso, URLs de redirect, estados de dia, cliente HTTP) e poucos testes de componente com jsdom + Testing Library: `MonthCalendar` (dias desabilitados e seleção por arraste) e `/agendar` (visitante enviado ao login com o `redirect` correto). Nenhum teste falsifica o relógio global.
- **Concorrência:** verificada por script manual contra o banco real (abaixo).
- Testes de integração com banco real (inclusive concorrência automatizada) e E2E ficam como melhoria futura.

## Verificação manual de concorrência

Com a API rodando (Docker ou `npm run dev`) e o seed aplicado:

```bash
npm run check:concurrency -w api
```

O script faz login como Maria, encontra um horário livre no mês atual ou no seguinte e dispara duas requisições `POST /api/appointments` simultâneas para ele. Resultado esperado: **uma `201` e uma `409 SLOT_ALREADY_BOOKED`**. No fim, cancela o agendamento criado (o horário volta a ficar livre; o registro fica como cancelado). Usa `http://localhost:${API_PORT:-3333}/api`, ou `API_URL` se definida.

## Limitações conhecidas

- **Espera do advisory lock sob carga alta.** Reservas e bloqueios são serializados por um único lock, e cada transação ocupa uma conexão do pool enquanto espera. Com dezenas de requisições simultâneas, a espera pode passar do `maxWait` (2 s) ou do `timeout` (5 s) das transações interativas do Prisma; o erro (`P2028`) vira `500 INTERNAL_ERROR` em vez de `409`. Não afeta a consistência, só a resposta, e o volume esperado de uma agenda única fica muito abaixo desse limite.
- **`npm audit` (Prisma 7).** O CLI `prisma` aponta vulnerabilidades altas em dependências transitivas (`deepmerge-ts` via `@prisma/config`, `mysql2`). O CLI só roda migrations e seed; o atendimento das requisições usa `@prisma/client` + `@prisma/adapter-pg`, que não carregam essas dependências. A correção sugerida (`npm audit fix --force`) faz downgrade para o Prisma 6, uma mudança incompatível, e por isso não foi aplicada.
- **Aviso de bundle > 500 kB no build do front.** O JS fica em um único arquivo de ~677 kB (~199 kB com gzip), sem um culpado único: `react-dom` (~200 KiB), `zod` (~85 KiB) e o restante das bibliotecas. Os locales do Zod não estão no bundle (só o pt-BR). Dividir o código por rota é possível, mas não muda o tamanho total de forma relevante para esta aplicação.

## Melhorias futuras

- Antecedência mínima para agendar e cancelar; limite de datas futuras; limite de agendamentos ativos por cliente.
- Status "Não compareceu" marcado pelo admin; admin agendar em nome de cliente.
- Exceções por data (abrir dia fechado, horário especial) e bloqueio de parte do dia.
- Vários intervalos por dia (pausa de almoço), mais durações, serviços com durações diferentes, múltiplos profissionais.
- Aviso ao admin quando uma mudança de configuração deixa agendamentos fora do horário.
- Notificações (e-mail/WhatsApp) de confirmação e cancelamento.
- Refresh token, rate limiting no login, recuperação de senha, edição de perfil.
- Cache da configuração da agenda, se houver necessidade.
- Testes de integração com banco real (incluindo concorrência automatizada) e E2E (Playwright).
- Visualização semanal em grade para o admin.
- nginx com usuário não-root.

## Desenvolvimento com IA

> _Seção a completar._

### Ferramentas e fluxo

- _TODO: ferramentas usadas (Claude Code, modelo) e como o trabalho foi organizado (PRD como fonte de verdade, `CLAUDE.md`, fases da seção 19)._

### Como a IA foi orientada

- _TODO: como o PRD e o `CLAUDE.md` guiaram as sessões; plano antes de codar; revisão por fase._

### O que funcionou bem

- _TODO_

### Onde foi preciso intervir ou corrigir

- _TODO: exemplos concretos (decisões revistas, bugs encontrados na revisão, armadilhas como fuso/relógio falso)._

### Verificação do que a IA produziu

- _TODO: testes, lint/typecheck, verificação manual no navegador e com o script de concorrência._
