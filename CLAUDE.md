# CLAUDE.md

Sistema de agendamentos full stack (teste técnico). **`PRD.md` é a fonte de verdade**: regras de negócio (seção 5), API (seção 10), modelo de dados (seção 8) e fases (seção 19). Leia a seção relevante antes de implementar algo. Se uma regra precisar mudar, atualize o PRD antes do código.

## Stack
- Monorepo npm workspaces: `apps/api` (Express 5 + Prisma + PostgreSQL), `apps/web` (React + Vite + Tailwind + shadcn/ui), `packages/shared` (schemas Zod, enums, tipos, helpers).
- TypeScript `strict` em tudo. Node 24 LTS. Datas com `date-fns` + `@date-fns/tz`.

## Comandos
```bash
docker compose up --build        # sobe tudo (db, api, web) em http://localhost:3000
docker compose up db             # só o banco, para desenvolvimento local
npm run dev                      # shared (watch) + api (API_PORT, padrão 3333) + web (5173)
npm test                         # testes de todos os workspaces
npm run lint && npm run typecheck
npm run test -w api              # só backend
npm run test -w web              # só frontend
npm run build -w web             # build do front (confere o tamanho do bundle)
npm run db:migrate -w api -- --name <nome>   # script que roda "prisma migrate dev" (ver regra sobre constraints abaixo)
npm run db:deploy -w api         # aplica migrations sem criar novas ("prisma migrate deploy")
npm run db:generate -w api       # gera o cliente Prisma em apps/api/src/generated (os scripts pre* da raiz já rodam)
npm run db:seed -w api           # seed idempotente (usuários, configuração, agendamentos de exemplo)
npm run check:concurrency -w api # verificação manual de concorrência (API rodando): espera uma 201 e uma 409
docker compose down -v           # zera o banco (volume pgdata); é o jeito de limpar dados de teste
```
Fora do Docker, copie `.env.example` para `.env` na raiz: `DATABASE_URL` e `JWT_SECRET` são obrigatórias (sem padrão). A porta da API é só `API_PORT`. O `.env` da raiz também é lido pelo Compose: para testar "sem `.env`", renomeie-o temporariamente.

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
- **Prisma:** siga a documentação oficial da versão instalada (Prisma 7: `prisma.config.ts`, driver adapter `@prisma/adapter-pg`, não carrega `.env` sozinho). O advisory lock usa `$executeRaw` (não `$queryRaw`: o adapter não desserializa `void`). A violação da constraint chega como `P2039` com `meta.driverAdapterError.cause.originalCode = '23P01'`.

## Testes do frontend
- Por padrão o Vitest do web roda em ambiente `node` (lógica pura, `*.test.ts`). Testes de componente são `*.test.tsx` com o docblock `// @vitest-environment jsdom` na primeira linha e `import '@/test/setup-dom'` (matchers do jest-dom + `cleanup`).
- **Não falsifique o relógio** (`vi.useFakeTimers`, `page.clock`): o `TZDate` perde o fuso. Injete o "agora" (props como `today`/`month`, `now` nas funções puras) ou use datas futuras fixas com a API falsa (`vi.stubGlobal('fetch', ...)`). Asserções de horário não podem depender do fuso da máquina.
- Arraste no `MonthCalendar`: o `onPointerEnter` do React é sintetizado de `pointerover`; use `userEvent.pointer` (gera a sequência completa).

## Ferramentas (armadilhas já encontradas)
- O `dev` da API usa `node --watch --import tsx`, não `tsx watch` (trava em silêncio sob `concurrently` com o cliente Prisma 7).
- npm 11 bloqueia install scripts: `prisma`, `@prisma/engines` e `esbuild` estão em `allowScripts` da raiz, fixados por versão. Ao atualizá-los, rode `npm approve-scripts <pkg>` + `npm rebuild`, senão as migrations quebram (também no Docker).
- TypeScript fixo em 6.0.3: o typescript-eslint 8.x exige `typescript <6.1`. Não atualize sem conferir o peer.
- `npx shadcn add` em `apps/web` resolve errado os aliases `@/` (cria a pasta `apps/web/@/` e uma dependência falsa `cn`): escreva os componentes shadcn à mão, importando `cn` de `@/lib/utils`.
- No Windows, ao parar o `npm run dev`, mate a árvore de processos (`taskkill /T /F`); matar só quem escuta nas portas deixa `concurrently`/`tsc --watch` vivos.
- Dependências com `engines` acima do Node 24 base (ex.: jsdom 30 exige 24.15) são evitadas: o projeto aceita qualquer Node 24.
- O aviso de bundle > 500 kB do Vite foi avaliado na Fase 8: não há culpado único (react-dom, zod…) e os locales do Zod já são tree-shaken; está documentado no README como limitação.

## Credenciais do seed
- Admin: `admin@agenda.com` / `admin123`
- Clientes: `maria@email.com` / `cliente123`, `joao@email.com` / `cliente123`
