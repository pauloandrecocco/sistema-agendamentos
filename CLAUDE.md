# CLAUDE.md

Sistema de agendamentos full stack (teste técnico). **`PRD.md` é a fonte de verdade**: regras de negócio (seção 5), API (seção 10), modelo de dados (seção 8) e fases (seção 19). Leia a seção relevante antes de implementar algo. Se uma regra precisar mudar, atualize o PRD antes do código.

## Stack
- Monorepo npm workspaces: `apps/api` (Express 5 + Prisma + PostgreSQL), `apps/web` (React + Vite + Tailwind + shadcn/ui), `packages/shared` (schemas Zod, enums, tipos, helpers).
- TypeScript `strict` em tudo. Node 24 LTS. Datas com `date-fns` + `@date-fns/tz`.

## Comandos
```bash
docker compose up --build        # sobe tudo (db, api, web) em http://localhost:3000
docker compose up db             # só o banco, para desenvolvimento local
npm run dev                      # shared (watch) + api (3333) + web (5173)
npm test                         # testes de todos os workspaces
npm run lint && npm run typecheck
npm run test -w api              # só backend
npm run db:migrate -w api -- --name <nome>   # script que roda "prisma migrate dev" (ver regra sobre constraints abaixo)
npm run check:concurrency -w api # verificação manual de concorrência (API rodando)
```

## Forma de trabalhar
- Implemente **uma fase por vez** (PRD seção 19). Ao final de cada fase: lint, typecheck e testes passando, depois commit (`feat: ...`, `fix: ...`, `test: ...`, `chore: ...`).
- Escreva os testes junto com o código, especialmente para o engine de disponibilidade e as regras de agendamento/cancelamento/bloqueio.
- Não adicione funcionalidades da seção 17 (Melhorias futuras) sem pedido explícito.
- Prefira a solução mais simples que cumpra o PRD.

## Convenções
- Código, nomes, commits e comentários em **inglês**. Textos da interface e `message` dos erros da API em **português (pt-BR)**.
- Backend por módulo: `modules/<nome>/<nome>.routes.ts → .controller.ts → .service.ts → .repository.ts`.
- Regras de negócio ficam nos **services**; validação de formato nos **schemas Zod** de `packages/shared` (reutilizados no front).
- Repositórios são interfaces com implementação Prisma e implementação em memória (testes). O app é criado por `createApp(deps)`.
- Erros: lance subclasses de `AppError` com os códigos da PRD seção 10.3. Nunca responda erro fora do formato `{ error: { code, message, details? } }`.
- Frontend: estado do servidor só via TanStack Query; formulários com React Hook Form + resolver Zod do `shared`; toasts com sonner.

## Regras críticas (fáceis de errar)
- **Fuso:** o fuso de negócio é a constante `BUSINESS_TIMEZONE` (`America/Sao_Paulo`) em `shared`. Nunca use o fuso da máquina (`new Date().getDate()`, `toLocaleDateString` sem `timeZone`, etc.). Todo agrupamento por dia usa o fuso de negócio.
- **Instantes** são `@db.Timestamptz(3)` no Prisma e ISO UTC na API. Datas `YYYY-MM-DD`, horários `HH:mm`.
- **`@db.Date`** (blocked_dates) vem do Prisma como meia-noite UTC: converta sempre pelo helper.
- **Slots:** uma única implementação em `availability.engine.ts` (funções puras, `now` injetado) serve tanto para consulta quanto para validar a reserva. Não duplique essa lógica.
- **Conflito:** sobreposição de intervalos `[start, end)`, nunca igualdade de início.
- **Constraints manuais:** a exclusion constraint `appointments_no_overlap` e o check `appointments_end_after_start` vivem em migration SQL editada à mão (`--create-only`). Se o Prisma gerar uma migration que as remova, edite para preservá-las.
- **Transações** de reserva e bloqueio passam por `TransactionManager.run`, que adquire `pg_advisory_xact_lock`. Violação da constraint (SQLSTATE `23P01`) é convertida para `409 SLOT_ALREADY_BOOKED` somente em `lib/prisma-errors.ts`.
- **Status:** banco só tem `CONFIRMED`/`CANCELLED`. "Concluído" é derivado por `getDisplayStatus` (`startAt <= now`). Cancelamento só se `startAt > now`. Nunca apague agendamentos.
- **Auth:** JWT em cookie httpOnly `access_token`; o front nunca lida com o token. Cadastro sempre cria `CLIENT`. Senhas com `bcryptjs`.
- **Prisma:** siga a documentação oficial da versão instalada (setup pode exigir `prisma.config.ts` / driver adapter).

## Credenciais do seed
- Admin: `admin@agenda.com` / `admin123`
- Clientes: `maria@email.com` / `cliente123`, `joao@email.com` / `cliente123`
