# PRD — Sistema de Agendamentos

> **Documento-fonte do projeto.** Toda implementação deve seguir este PRD. Se alguma regra precisar mudar durante o desenvolvimento, atualize este documento primeiro.

---

## 1. Visão geral

### 1.1 Contexto
Uma empresa precisa de uma aplicação web para gerenciar agendamentos. Existem dois tipos de usuário:
- **Cliente** — consulta horários, agenda, acompanha e cancela os próprios agendamentos.
- **Administrador** — acompanha e gerencia os agendamentos recebidos e configura a agenda.

O projeto é um **teste técnico** que avalia o desenvolvimento de uma aplicação com apoio de IA (Claude Code). Não irá para produção. Prioridades, em ordem:
1. **Correção das regras de negócio** (sem conflitos, sem agendamentos no passado, dados persistidos, erros bem tratados).
2. **Simplicidade** — solução sólida, mas sem complexidade desnecessária.
3. **Decisões explicáveis** — cada escolha técnica tem justificativa registrada (seção 16).
4. Execução com um único comando: `docker compose up --build`.

### 1.2 Requisitos originais → onde são atendidos

| Requisito original | Onde é atendido |
|---|---|
| Cliente consulta horários disponíveis | RF-02, RF-03 (público) |
| Cliente realiza agendamento | RF-04 |
| Cliente visualiza seus agendamentos | RF-05 |
| Cliente cancela seus agendamentos | RF-06 |
| Admin visualiza e gerencia agendamentos | RF-07 a RF-11 |
| Evitar conflitos de horário | RN-07, RN-13, seção 9 |
| Não permitir datas/horários passados | RN-05, RN-06 (e RN-08, RN-11, RN-12 para cancelamento e bloqueio) |
| Dados persistidos | PostgreSQL + Prisma (seção 8) + volume Docker (seção 14) |
| Tratamento de operações inválidas | Seções 11 e 12 |
| Executável via `docker compose up --build` | Seção 14 |

---

## 2. Escopo

### 2.1 Dentro do escopo (v1)
- Cadastro e login de clientes (e-mail + senha; telefone opcional).
- Login do administrador (conta criada via seed).
- Consulta **pública** de dias e horários disponíveis; login exigido só para confirmar.
- Agendamento com confirmação automática.
- "Meus agendamentos" com abas Próximos / Histórico e cancelamento.
- Painel administrativo: resumo, aba **Agenda** (calendário mensal + agendamentos do dia + modo de bloqueio), aba **Todos** (lista com filtros e paginação), cancelamento.
- Configuração da agenda: duração do slot (30 ou 60 min) e horário semanal (um intervalo por dia).
- Bloqueio e desbloqueio de dias inteiros (cancela agendamentos afetados após confirmação).
- Seed com admin, 2 clientes, configuração padrão e agendamentos de exemplo.
- Testes automatizados (backend com mocks; poucos testes de frontend).
- Docker Compose com banco, API e frontend.

### 2.2 Fora do escopo (v1)
Ver seção 17 (Melhorias futuras).

---

## 3. Papéis e acesso

| Papel | Como obtém acesso | Pode |
|---|---|---|
| Visitante (não logado) | — | Ver calendário e horários disponíveis; cadastrar-se; fazer login |
| `CLIENT` | Cadastro pela tela ou seed | Tudo do visitante + agendar, ver e cancelar **os próprios** agendamentos |
| `ADMIN` | Somente seed | Painel administrativo completo. **Não** faz agendamentos (rotas de cliente retornam 403) |

- O cadastro **sempre** cria usuário `CLIENT`; qualquer campo `role` enviado é ignorado.
- Login único (`/login`) para os dois papéis; após login, redireciona conforme o papel (ou para o `redirect` solicitado).

---

## 4. Glossário

| Termo | Significado |
|---|---|
| **Fuso de negócio** | `America/Sao_Paulo`. Toda data `YYYY-MM-DD` e todo horário `HH:mm` são interpretados nesse fuso. Definido como constante em `packages/shared`. |
| **Horário semanal** | Para cada dia da semana: ativo/inativo + início e fim (`HH:mm`). Um intervalo por dia. |
| **Duração do slot** | 30 ou 60 minutos (padrão 30). Global para a agenda. |
| **Slot** | Intervalo `[início, início + duração)` gerado a partir do horário semanal. |
| **Bloqueio** | Data específica em que a agenda fica fechada, independentemente do horário semanal. |
| **Dia fechado** | Dia cuja regra semanal está inativa. |
| **Status persistido** | `CONFIRMED` ou `CANCELLED` (gravado no banco). |
| **Status de exibição** | `CONFIRMED`, `COMPLETED` ou `CANCELLED` — derivado (RN-09). `COMPLETED` nunca é gravado. |

---

## 5. Regras de negócio

**RN-01 — Agenda única.** Existe um único recurso atendendo; dois agendamentos confirmados nunca podem se sobrepor no tempo.

**RN-02 — Duração do slot.** Valores permitidos: `30` ou `60` minutos. Padrão: `30`.

**RN-03 — Horário semanal.**
- 7 registros, um por dia da semana (`0` = domingo … `6` = sábado).
- Cada dia tem `isActive`, `startTime` e `endTime` no formato `HH:mm`, **somente em horas cheias ou meias-horas** (`:00` ou `:30`), entre `00:00` e `23:30`.
- Regra de validação: `endTime > startTime`. Os horários são mantidos mesmo quando o dia está inativo (para reativar sem redigitar).
- Um dia ativo cujo intervalo não comporta nenhum slot simplesmente não terá horários (não é erro).

**RN-04 — Geração de slots de um dia.** Para uma data `D`:
1. Se `D` está bloqueada → nenhum slot.
2. Se o dia da semana de `D` está inativo → nenhum slot.
3. Caso contrário, slots começam em `startTime` e avançam de `duração` em `duração` enquanto `início + duração ≤ endTime`. Slot que não cabe inteiro é descartado.
4. Todos os cálculos no fuso de negócio; resultados convertidos para instantes UTC.

**RN-05 — Slot disponível.** Um slot gerado está disponível se:
- `início > agora`, **e**
- não se sobrepõe a nenhum agendamento `CONFIRMED` (comparação por sobreposição de intervalos `[start, end)`, não por igualdade de início).

**RN-06 — Criação de agendamento.**
- Somente usuário `CLIENT`.
- O cliente envia apenas `startAt`. O servidor recalcula os slots do dia **com a mesma função usada na consulta de disponibilidade** (fonte única de verdade):
  - `startAt` no passado → `422 SLOT_IN_PAST`.
  - `startAt` não corresponde exatamente ao início de um slot gerado (dia fechado, bloqueado, fora do expediente, desalinhado) → `422 SLOT_NOT_AVAILABLE`.
  - Slot sobreposto a agendamento confirmado → `409 SLOT_ALREADY_BOOKED`.
- `endAt = startAt + duração atual`. A duração fica "congelada" no agendamento.
- Nasce com status `CONFIRMED` (confirmação automática).
- Sem limite de antecedência e sem limite de agendamentos por cliente na v1.

**RN-07 — Conflito garantido em duas camadas.**
1. Aplicação: validações da RN-06 (mensagem amigável).
2. Banco: *exclusion constraint* que impede sobreposição de agendamentos `CONFIRMED` (seção 9). Violação → `409 SLOT_ALREADY_BOOKED`.

**RN-08 — Cancelamento.**
- Só é possível cancelar agendamento `CONFIRMED` com `startAt > agora`.
  - Já cancelado → `422 APPOINTMENT_ALREADY_CANCELLED`.
  - Já iniciado (`startAt ≤ agora`) → `422 APPOINTMENT_ALREADY_STARTED`.
- Cliente só cancela os **próprios**; agendamento de outro cliente → `404 NOT_FOUND` (não revela existência).
- Admin cancela qualquer agendamento (mesmas restrições de tempo/status).
- Ao cancelar: `status = CANCELLED`, `cancelledBy = CLIENT | ADMIN`, `cancelledAt = agora`. O registro **nunca é apagado**.
- Cancelar libera o horário imediatamente.

**RN-09 — Status de exibição (critério único: início do atendimento).**
| Persistido | Condição | Exibição | Rótulo na UI |
|---|---|---|---|
| `CONFIRMED` | `startAt > agora` | `CONFIRMED` | Confirmado |
| `CONFIRMED` | `startAt ≤ agora` | `COMPLETED` | Concluído |
| `CANCELLED` | — | `CANCELLED` | Cancelado (por você / pelo estabelecimento / pelo cliente) |

Calculado em **um único helper** compartilhado; a API devolve `status` e `displayStatus`.

**RN-10 — Alterar configuração não afeta agendamentos existentes.** Mudar duração ou horário semanal não altera nem cancela agendamentos. Agendamentos que ficarem fora do novo horário continuam válidos e visíveis no calendário do admin (contagem por dia), que decide manualmente. Slots futuros respeitam sobreposição com eles (RN-05).

**RN-11 — Bloqueio de dias.**
- Só datas `≥ hoje` (fuso de negócio); data passada → `422 INVALID_DATE`.
- Dias fechados pela regra semanal também podem ser bloqueados (útil se o dia for reaberto depois).
- Bloquear data já bloqueada é idempotente.
- Na **mesma transação**, todos os agendamentos `CONFIRMED` dessas datas com `startAt > agora` são cancelados com `cancelledBy = ADMIN`. Agendamentos que já começaram (ex.: hoje mais cedo) permanecem.
- A resposta devolve as datas bloqueadas e a lista de agendamentos cancelados.
- A UI exige confirmação informando quantos agendamentos serão cancelados (contagem estimada a partir do calendário; a mensagem final usa a lista real devolvida pela API).

**RN-12 — Desbloqueio.** Só datas `≥ hoje`. Remove o bloqueio; **não restaura** agendamentos cancelados.

**RN-13 — Concorrência entre reservar e bloquear.** Criação de agendamento e bloqueio de datas executam em transação que adquire o mesmo *advisory lock* do Postgres (`pg_advisory_xact_lock`), serializando essas operações. Impede que uma reserva seja concluída num dia bloqueado simultaneamente. A exclusion constraint continua como garantia final contra sobreposição.

**RN-14 — Dados de usuário.**
- `name`: 2–100 caracteres (trim).
- `email`: formato válido, normalizado para minúsculas, único → duplicado `409 EMAIL_ALREADY_IN_USE`.
- `phone`: **opcional**; aceita máscara, armazenado só com dígitos; se informado, 10 ou 11 dígitos (DDD + número).
- `password`: 8–72 caracteres; armazenada como hash bcrypt.
- Login com credenciais inválidas → `401 INVALID_CREDENTIALS` com mensagem genérica (não revela se o e-mail existe).

**RN-15 — Datas e fuso.**
- Instantes trafegam em ISO 8601 UTC (`2026-10-05T12:00:00.000Z`) e são gravados como `timestamptz`.
- Datas de calendário trafegam como `YYYY-MM-DD`; horários de configuração como `HH:mm`; ambos no fuso de negócio.
- **Todo agrupamento "por dia"** (calendários, resumo, filtros de período, bloqueio) usa o fuso de negócio — nunca a data UTC. Ex.: 22:00 em São Paulo = 01:00 UTC do dia seguinte, mas pertence ao dia local.

---

## 6. Requisitos funcionais

### 6.1 Autenticação
**RF-01 — Cadastro, login e logout.**
- Cadastro: nome, e-mail, telefone (opcional), senha. Após cadastro, usuário já fica logado.
- Login: e-mail e senha.
- Logout: limpa o cookie de sessão.
- Telas de login e cadastro aceitam `?redirect=<caminho interno>`; após sucesso, voltam a ele. Só caminhos internos são aceitos (evita *open redirect*): o valor deve começar com `/` e **não** com `//` nem `/\` (navegadores tratam `/\site.com` como `//site.com`). Valor recusado é ignorado (vale o destino padrão). Sem `redirect`: `ADMIN → /admin`, `CLIENT → /agendar`.

### 6.2 Cliente / visitante
**RF-02 — Calendário de disponibilidade (público).** Calendário mensal; cada dia tem um estado: `AVAILABLE` (com vagas), `NO_SLOTS` (aberto, mas sem vagas — inclui hoje com todos os horários já passados), `CLOSED`, `BLOCKED`, `PAST`. Apenas `AVAILABLE` é clicável. Navegação livre entre meses futuros; meses passados desabilitados.

**RF-03 — Horários do dia (público).** Ao escolher um dia, exibe grade com os slots livres (ex.: "09:00", "09:30"…).

**RF-04 — Agendar.**
- Clicar num horário:
  - Visitante → vai para `/login?redirect=/agendar?date=YYYY-MM-DD&slot=<startAt>`; o link "Criar conta" preserva o `redirect`.
  - `CLIENT` → abre modal "Confirmar agendamento em 05/10/2026 às 14:00?".
  - `ADMIN` → horários visíveis, mas a ação mostra aviso "Administradores não realizam agendamentos".
- Ao voltar do login com `date` e `slot` na URL, abre o modal automaticamente se o slot ainda estiver livre; senão, toast "Esse horário não está mais disponível".
- Sucesso → toast + redireciona para `/meus-agendamentos`.
- `409` → toast "Esse horário acabou de ser reservado" e recarrega os horários.

**RF-05 — Meus agendamentos.** Abas:
- **Próximos**: `CONFIRMED` com `startAt > agora`, ordem crescente.
- **Histórico**: concluídos e cancelados, ordem decrescente, indicando "Cancelado por você" ou "Cancelado pelo estabelecimento".

**RF-06 — Cancelar.** Botão "Cancelar" nos itens de Próximos, com diálogo de confirmação. Erros de RN-08 exibidos como toast.

### 6.3 Administrador
**RF-07 — Resumo.** No topo do painel: **Hoje** (agendamentos não cancelados — status persistido `CONFIRMED` — com data de hoje, inclusive os já iniciados) e **Próximos 7 dias** (não cancelados, de amanhã até hoje + 7).

**RF-08 — Aba Agenda.**
- Calendário mensal mostrando, por dia: quantidade de agendamentos não cancelados (status persistido `CONFIRMED`, incluindo os já concluídos), se está bloqueado, fechado (regra semanal) ou passado.
- **Modo visualização (padrão):** clicar num dia exibe ao lado a lista do dia (horário, cliente, telefone/e-mail, status de exibição, ação "Cancelar"). Inclui cancelados (visual atenuado).
- **Modo bloqueio** (interruptor "Gerenciar bloqueios"): clicar alterna a seleção de um dia; **clicar e arrastar** seleciona um intervalo (desktop). Em toque, cada toque alterna um dia. Dias passados não selecionáveis. Barra de ações: "Bloquear N dias" / "Desbloquear N dias" / "Limpar seleção". Bloquear abre confirmação com a estimativa de agendamentos que serão cancelados (RN-11).

**RF-09 — Aba Todos.** Lista paginada (20 por página) agrupada visualmente por dia, com filtros:
- Período (`de` / `até`; padrão: de hoje em diante, sem fim).
- Status de exibição: Todos / Confirmado / Concluído / Cancelado.
- Busca por cliente (nome, e-mail ou telefone; contém, sem diferenciar maiúsculas).

**RF-10 — Cancelar (admin).** Disponível nas duas abas, com confirmação. Regras de RN-08.

**RF-11 — Configurações da agenda (`/admin/configuracoes`).**
- Duração do slot: 30 ou 60 min.
- 7 linhas (Dom–Sáb): interruptor ativo, select de início, select de fim (opções de 30 em 30 min, `00:00`–`23:30`).
- Salvar envia tudo de uma vez; validação no front e no back (RN-02, RN-03).

---

## 7. Arquitetura

### 7.1 Stack
| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24 LTS |
| Backend | Express 5, TypeScript, Zod, Prisma, `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `helmet` |
| Datas | `date-fns` + `@date-fns/tz` (front e back) |
| Banco | PostgreSQL 17 |
| Frontend | React + Vite + TypeScript, React Router (modo declarativo), TanStack Query, React Hook Form + Zod, Tailwind CSS + shadcn/ui, sonner (toasts) |
| Testes | Vitest + Supertest (backend, com repositórios falsos em memória); Vitest + Testing Library (frontend) |
| Infra | Docker Compose; nginx servindo o frontend e fazendo proxy de `/api` |
| Qualidade | ESLint + Prettier; TypeScript `strict` |

Usar as versões estáveis atuais e **fixá-las** no `package.json`. Para Prisma, seguir a documentação oficial da versão instalada (versões recentes podem exigir `prisma.config.ts` e *driver adapter*).

### 7.2 Estrutura do monorepo (npm workspaces)
```
/
├── apps/
│   ├── api/
│   │   ├── prisma/            # schema.prisma, migrations/, seed.ts
│   │   ├── scripts/           # concurrency-check.ts
│   │   ├── src/
│   │   │   ├── app.ts         # createApp(deps) — monta o Express
│   │   │   ├── server.ts      # bootstrap: Prisma, repositórios, services, listen
│   │   │   ├── config/env.ts  # leitura e validação (Zod) das variáveis de ambiente
│   │   │   ├── lib/           # errors, time (fuso), jwt, password, prisma-errors
│   │   │   ├── middlewares/   # authenticate, requireRole, validate, errorHandler
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── availability/   # inclui availability.engine.ts (funções puras)
│   │   │       ├── appointments/
│   │   │       ├── schedule/
│   │   │       └── admin/
│   │   └── test/              # fakes (repositórios em memória), helpers
│   └── web/
│       ├── nginx.conf
│       └── src/
│           ├── app/           # router, providers, layout
│           ├── pages/
│           ├── features/      # auth, booking, my-appointments, admin
│           ├── components/    # ui/ (shadcn), MonthCalendar/
│           └── lib/           # api client, formatação de datas
├── packages/
│   └── shared/                # schemas Zod, enums, tipos, helpers de tempo e status
├── docker-compose.yml
├── .env.example
├── PRD.md
├── CLAUDE.md
└── README.md
```

### 7.3 Módulos do backend
Cada módulo: `*.routes.ts → *.controller.ts → *.service.ts → *.repository.ts`.

| Módulo | Responsabilidade |
|---|---|
| `auth` | Cadastro, login, logout, `me`; hash de senha; emissão/validação do JWT; middlewares `authenticate` e `requireRole` |
| `availability` | Somente leitura: gera slots e estados de dias. O núcleo é `availability.engine.ts`, **funções puras** (sem I/O) que recebem config, bloqueios, agendamentos e `now` |
| `appointments` | Criar (com transação + lock), listar do cliente, cancelar; tradução do erro da constraint para 409 |
| `schedule` | Ler/salvar duração e horário semanal; bloquear/desbloquear datas (com cancelamento em lote) |
| `admin` | Consultas do painel: resumo, calendário com contagens, lista filtrada/paginada. Reutiliza services dos outros módulos; não duplica regras |

### 7.4 Injeção de dependências e transações
- `createApp(deps)` recebe services já construídos; `server.ts` monta as implementações com Prisma. Nos testes, monta-se o app com **repositórios falsos em memória**.
- Repositórios são definidos por **interfaces**; há implementação Prisma e implementação em memória.
- Operações transacionais usam uma abstração `TransactionManager.run(fn)`, que entrega a `fn` repositórios vinculados à transação:
  - Implementação Prisma: `prisma.$transaction(async (tx) => { await tx.$executeRaw\`SELECT pg_advisory_xact_lock(<SCHEDULE_LOCK_KEY>)\`; return fn(reposFrom(tx)); })`. Usa `$executeRaw` (não `$queryRaw`): a função retorna `void`, que o driver adapter do Prisma 7 não desserializa.
  - Implementação fake: apenas executa `fn` com os repositórios em memória.
- `getScheduleConfig()` retorna duração + horário semanal em uma chamada. É lida do banco a cada operação (leitura de PK, custo desprezível; mudanças valem na hora; sem cache para invalidar). Dentro da reserva, é lida **na mesma transação**.

### 7.5 Pacote `shared`
Compilado com `tsc` para `dist/` (com tipos); consumido por `api` e `web`. Contém:
- Schemas Zod de entrada (auth, criação de agendamento, configuração, bloqueio, query params).
- Enums: `Role`, `AppointmentStatus`, `DisplayStatus`, `CancelledBy`, `DayAvailabilityStatus`, `SLOT_DURATIONS = [30, 60]`.
- Tipos de DTO (`z.infer` + tipos de resposta).
- Constantes: `BUSINESS_TIMEZONE = 'America/Sao_Paulo'`, `TIME_OPTIONS` (`00:00`…`23:30`).
- Helpers: `timeToMinutes`, `minutesToTime`, `getDisplayStatus(appointment, now)`, `normalizePhone`.

---

## 8. Modelo de dados

Convenção: modelos Prisma em PascalCase; tabelas/colunas em snake_case via `@@map`/`@map`. **Todo instante usa `@db.Timestamptz(3)`** (o padrão do Prisma é `timestamp` sem fuso, que não serve para a constraint nem para fuso).

### 8.1 Tabelas

**`users`**
| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid | PK |
| name | text | obrigatório |
| email | text | único, minúsculo |
| phone | text | opcional, só dígitos |
| password_hash | text | bcrypt |
| role | enum `Role` (`CLIENT`, `ADMIN`) | padrão `CLIENT` |
| created_at / updated_at | timestamptz | |

**`schedule_settings`** — linha única (`id = 1`)
| Coluna | Tipo | Regras |
|---|---|---|
| id | int | PK, sempre 1 |
| slot_duration_minutes | int | 30 ou 60 |
| updated_at | timestamptz | |

**`working_hours`** — 7 linhas
| Coluna | Tipo | Regras |
|---|---|---|
| weekday | int | PK, 0–6 (0 = domingo) |
| is_active | boolean | |
| start_time | text | `HH:mm`, `:00`/`:30` |
| end_time | text | `HH:mm`, `:00`/`:30`, `> start_time` |

> Horários como texto `HH:mm`: legível no banco, na API e na UI; zero-padded permite comparação direta. Contas usam `timeToMinutes`.

**`blocked_dates`**
| Coluna | Tipo | Regras |
|---|---|---|
| date | date | PK (data no fuso de negócio) |
| created_at | timestamptz | |

> O Prisma representa `@db.Date` como `Date` à meia-noite UTC. Converter sempre via helper (`YYYY-MM-DD` ↔ `Date`), nunca com fuso local da máquina.

**`appointments`**
| Coluna | Tipo | Regras |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → users.id |
| start_at | timestamptz | |
| end_at | timestamptz | `> start_at` |
| status | enum `AppointmentStatus` (`CONFIRMED`, `CANCELLED`) | padrão `CONFIRMED` |
| cancelled_by | enum `CancelledBy` (`CLIENT`, `ADMIN`) | nulo se não cancelado |
| cancelled_at | timestamptz | nulo se não cancelado |
| created_at / updated_at | timestamptz | |

Índices: `(start_at)`, `(client_id, start_at)`.

### 8.2 Migration manual de constraints
Criar com `prisma migrate dev --create-only --name appointments_constraints` e editar o SQL:
```sql
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_end_after_start" CHECK ("end_at" > "start_at");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');
```
- `'[)'`: intervalo fechado no início e aberto no fim → 09:00–09:30 e 09:30–10:00 **não** conflitam.
- O `WHERE` faz cancelados não ocuparem horário.
- Não requer extensão (`gist` suporta `tstzrange` nativamente).
- Se uma migration futura gerada pelo Prisma tentar remover essas constraints, editar o SQL para preservá-las.

---

## 9. Disponibilidade e consistência

### 9.1 Engine (funções puras em `availability.engine.ts`)
- `generateDaySlots({ date, config, isBlocked })` → slots válidos do dia (RN-04), ignorando ocupação e "agora".
- `getAvailableSlots({ date, config, isBlocked, appointments, now })` → filtra `início > now` e sobreposição com `CONFIRMED` (RN-05).
- `getMonthDayStatuses({ month, config, blockedDates, appointments, now, today })` → estado de cada dia: `PAST` (data < hoje), `CLOSED`, `BLOCKED`, `AVAILABLE` (≥ 1 slot livre) ou `NO_SLOTS`.
- Sobreposição: `a.start < b.end && b.start < a.end`.

### 9.2 Fluxo de criação de agendamento
```
TransactionManager.run(async (repos) => {          // inclui pg_advisory_xact_lock
  config     = repos.schedule.getScheduleConfig()
  isBlocked  = repos.blockedDates.exists(dateOf(startAt))
  slots      = generateDaySlots(...)
  if startAt <= now                         -> 422 SLOT_IN_PAST
  if startAt not in slots                   -> 422 SLOT_NOT_AVAILABLE
  if overlaps(repos.appointments.confirmedBetween(...)) -> 409 SLOT_ALREADY_BOOKED
  repos.appointments.create({ startAt, endAt: startAt + duration, ... })
})
// erro da constraint appointments_no_overlap (SQLSTATE 23P01) -> 409 SLOT_ALREADY_BOOKED
```
A conversão do erro do banco fica em **um único ponto** (`lib/prisma-errors.ts`), identificando a violação pelo nome da constraint / SQLSTATE `23P01`. Com Prisma 7 + `@prisma/adapter-pg` (verificado no banco real), a violação chega como `PrismaClientKnownRequestError` de código genérico `P2039`, com `meta.driverAdapterError.cause = { kind: 'postgres', originalCode: '23P01', originalMessage: '... "appointments_no_overlap"' }` — igual dentro ou fora da transação interativa.

**Cancelamento** (RN-08) usa atualização condicional (`UPDATE ... WHERE id = ? AND status = 'CONFIRMED'`); se nenhuma linha for afetada (outro cancelamento concorrente venceu), responde `422 APPOINTMENT_ALREADY_CANCELLED`. Dois cancelamentos simultâneos nunca se sobrescrevem.

### 9.3 Fluxo de bloqueio
Mesma transação com o mesmo advisory lock: valida datas `≥ hoje` → insere bloqueios (ignorando existentes) → cancela `CONFIRMED` dessas datas com `startAt > now` (`cancelledBy = ADMIN`) → retorna bloqueios e cancelados.

### 9.4 Verificação manual de concorrência
Script `apps/api/scripts/concurrency-check.ts` (`npm run check:concurrency -w api`): faz login com um cliente do seed, busca um slot livre e dispara **duas** requisições `POST /api/appointments` simultâneas para ele. Resultado esperado: uma `201` e uma `409`. Documentado no README. (Teste automatizado com banco real é melhoria futura.)

---

## 10. API

Base: `/api`. JSON. Autenticação via cookie httpOnly (seção 13).

### 10.1 Endpoints

**Saúde**
| Método | Rota | Acesso | Resposta |
|---|---|---|---|
| GET | `/health` | público | `200 { status: "ok" }` |

**Auth**
| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| POST | `/auth/register` | público | `{ name, email, phone?, password }` | `201 { user }` + cookie |
| POST | `/auth/login` | público | `{ email, password }` | `200 { user }` + cookie |
| POST | `/auth/logout` | público | — | `204` (limpa cookie) |
| GET | `/auth/me` | autenticado | — | `200 { user }` |

`user = { id, name, email, phone, role }`

**Disponibilidade (pública)**
| Método | Rota | Resposta |
|---|---|---|
| GET | `/availability/calendar?month=YYYY-MM` | `200 { month, days: [{ date, status }] }` — `status ∈ AVAILABLE, NO_SLOTS, CLOSED, BLOCKED, PAST` |
| GET | `/availability?date=YYYY-MM-DD` | `200 { date, slotDurationMinutes, slots: [{ startAt, endAt }] }` — apenas slots livres |

**Agendamentos do cliente** (`CLIENT`)
| Método | Rota | Corpo / Query | Resposta |
|---|---|---|---|
| POST | `/appointments` | `{ startAt }` | `201 { appointment }` |
| GET | `/appointments/me` | `?scope=upcoming\|history` | `200 { items: [appointment] }` |
| POST | `/appointments/:id/cancel` | — | `200 { appointment }` |

`appointment = { id, startAt, endAt, status, displayStatus, cancelledBy, cancelledAt, createdAt }`

**Admin** (`ADMIN`)
| Método | Rota | Corpo / Query | Resposta |
|---|---|---|---|
| GET | `/admin/summary` | — | `200 { today, next7Days }` |
| GET | `/admin/calendar` | `?month=YYYY-MM` | `200 { month, days: [{ date, appointmentsCount, isClosed, isBlocked, isPast }] }` |
| GET | `/admin/appointments` | `?from&to&status&search&page&pageSize` | `200 { items: [appointment + client], page, pageSize, total }` |
| POST | `/admin/appointments/:id/cancel` | — | `200 { appointment }` |
| GET | `/admin/schedule` | — | `200 { slotDurationMinutes, workingHours: [{ weekday, isActive, startTime, endTime }] }` |
| PUT | `/admin/schedule` | mesmo formato | `200 { ...config }` |
| POST | `/admin/blocked-dates` | `{ dates: ["YYYY-MM-DD"] }` (1–92) | `200 { blockedDates, cancelledAppointments }` |
| POST | `/admin/blocked-dates/unblock` | `{ dates: ["YYYY-MM-DD"] }` (1–92) | `200 { unblockedDates }` |

Detalhes de `/admin/appointments`:
- `from`/`to`: `YYYY-MM-DD`, inclusivos, fuso de negócio. Padrão: `from = hoje`, sem `to`. `from > to` → `400 VALIDATION_ERROR`.
- `status`: `CONFIRMED | COMPLETED | CANCELLED` (status de exibição; traduzido para consulta conforme RN-09).
- `search`: contém em nome, e-mail ou telefone (case-insensitive). Como o telefone é gravado só com dígitos, ele é comparado com os dígitos do termo (ex.: `(11) 9876` encontra `119876…`) — apenas quando o termo tiver ao menos 1 dígito (senão a comparação seria `contains ""` e casaria com todos).
- `page` padrão 1; `pageSize` padrão 20, máx. 100. Ordem: `startAt` crescente.
- Cada item inclui `client: { id, name, email, phone }`.
- A aba Agenda usa esta rota com `from = to = dia selecionado`.

Detalhes de configuração e bloqueio:
- `PUT /admin/schedule` grava duração e os 7 dias em uma única transação (`TransactionManager.run`), atômica e serializada com as reservas. Não altera agendamentos (RN-10).
- `POST /admin/blocked-dates`: `cancelledAppointments` é uma lista de `appointment` (mesmo formato do cliente, sem `client`); `blockedDates` são as datas pedidas (sem repetição, ordenadas), todas bloqueadas ao final.
- `POST /admin/blocked-dates/unblock`: `unblockedDates` são as datas pedidas (idempotente: desbloquear data não bloqueada não é erro).

Cancelamento é `POST` de ação (não `DELETE`): o registro muda de estado, não é removido.

### 10.2 Formato de erro
```json
{ "error": { "code": "SLOT_ALREADY_BOOKED", "message": "Este horário já foi reservado.", "details": {} } }
```
`message` em português (exibível ao usuário). `details` opcional (ex.: erros de campo de validação).

### 10.3 Códigos de erro
| HTTP | code | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Corpo/query inválidos (Zod), JSON malformado ou outra falha de leitura do corpo; `details` com erros por campo (quando houver) |
| 401 | `UNAUTHENTICATED` | Sem cookie ou token inválido/expirado |
| 401 | `INVALID_CREDENTIALS` | Login inválido |
| 403 | `FORBIDDEN` | Papel não autorizado |
| 404 | `NOT_FOUND` | Recurso inexistente ou de outro cliente |
| 409 | `EMAIL_ALREADY_IN_USE` | Cadastro com e-mail existente |
| 409 | `SLOT_ALREADY_BOOKED` | Sobreposição (aplicação ou constraint) |
| 413 | `PAYLOAD_TOO_LARGE` | Corpo acima do limite do leitor JSON (100 kB) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `POST`/`PUT` com corpo e `Content-Type` diferente de `application/json` |
| 422 | `SLOT_IN_PAST` | `startAt` no passado |
| 422 | `SLOT_NOT_AVAILABLE` | `startAt` não é slot válido |
| 422 | `APPOINTMENT_ALREADY_CANCELLED` | Cancelar já cancelado |
| 422 | `APPOINTMENT_ALREADY_STARTED` | Cancelar já iniciado |
| 422 | `INVALID_DATE` | Bloquear/desbloquear data passada |
| 500 | `INTERNAL_ERROR` | Inesperado (sem detalhes internos na resposta; log no servidor) |

---

## 11. Validação
- Schemas Zod em `packages/shared`, usados no front (React Hook Form) e no back (middleware `validate` para `body`, `query`, `params`).
- Regras de negócio que dependem de estado (slot disponível, conflito, já cancelado) ficam nos **services**, não nos schemas.
- Variáveis de ambiente validadas com Zod na inicialização (`config/env.ts`); falha → processo não sobe.

## 12. Tratamento de erros
- Hierarquia `AppError(httpStatus, code, message, details?)` com subclasses (`ValidationError`, `UnauthenticatedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`).
- Um único `errorHandler` converte `AppError`, `ZodError` e erros do Prisma (via `lib/prisma-errors.ts`) no formato da seção 10.2. Express 5 encaminha rejeições de handlers `async` automaticamente.
- O formato padrão vale também para erros fora dos handlers de rota:
  - Rota inexistente em qualquer caminho do servidor da API (inclusive `/api/*`) → `404 NOT_FOUND` (handler *catch-all* registrado depois das rotas).
  - JSON malformado ou outra falha de leitura do corpo → `400 VALIDATION_ERROR`.
  - Corpo acima do limite → `413 PAYLOAD_TOO_LARGE`.
  - Nunca há resposta HTML nem stack trace.
- Frontend: cliente HTTP converte respostas de erro em `ApiError { status, code, message, details }`; formulários mostram erros de campo; demais erros viram toast.

## 13. Autenticação e segurança
- JWT (`sub` = userId, `role`), expiração `JWT_EXPIRES_IN` (padrão 8h), sem refresh token.
- Token em **cookie httpOnly** `access_token`: `SameSite=Lax`, `Secure` conforme `COOKIE_SECURE` (false em ambiente local http), `path=/`, `maxAge` igual à expiração.
  - JavaScript não lê o cookie → token protegido contra roubo via XSS.
  - Front não armazena nem anexa token; descobre a sessão via `GET /auth/me`.
  - CSRF mitigado por `SameSite=Lax` + mesma origem (nginx no Docker, proxy do Vite em dev) + API só aceita JSON.
- **Somente JSON:** requisição `POST`/`PUT` **com corpo** e `Content-Type` diferente de `application/json` → `415 UNSUPPORTED_MEDIA_TYPE`. Requisições sem corpo (ex.: cancelamentos, logout) não são afetadas.
- `helmet` habilitado. Senhas com `bcryptjs` (sem dependência nativa no Docker Alpine).
- Sem CORS (mesma origem).

## 14. Docker e ambiente

### 14.1 Serviços (`docker-compose.yml`)
| Serviço | Imagem/Build | Detalhes |
|---|---|---|
| `db` | `postgres:17-alpine` | volume `pgdata`; healthcheck `pg_isready`; porta `${DB_PORT:-5432}` |
| `api` | `apps/api/Dockerfile` (multi-stage; contexto na raiz para incluir `packages/shared`) | sobe após `db` saudável; comando: `prisma migrate deploy` → `node dist/prisma/seed.js` (seed compilado com `tsc` junto com a API) → `node dist/src/server.js`; healthcheck em `/api/health`; dentro do container escuta **fixo na 3333** (o compose define `API_PORT=3333` no container) e publica `${API_PORT:-3333}:3333` (exposta para debug) |
| `web` | `apps/web/Dockerfile` (build Vite → `nginx:alpine`) | `nginx.conf`: SPA fallback (`try_files … /index.html`) e `location /api/ → http://api:3333`; sobe após `api` saudável; porta `${WEB_PORT:-3000}` |

Aplicação acessível em **http://localhost:3000**.

### 14.2 Variáveis (`.env` na raiz, opcional)
O Compose lê `.env` automaticamente; cada variável tem padrão via `${VAR:-padrão}`, então `docker compose up --build` funciona sem `.env`. `.env` no `.gitignore`; `.env.example` versionado:
```
POSTGRES_USER=agenda
POSTGRES_PASSWORD=agenda
POSTGRES_DB=agenda
DB_PORT=5432
# Fora do Docker: porta em que a API escuta (e destino do proxy do Vite). No Docker: porta publicada no host (a API escuta fixo na 3333)
API_PORT=3333
WEB_PORT=3000
# Usado no desenvolvimento fora do Docker; no Compose é montado apontando para o host "db"
DATABASE_URL=postgresql://agenda:agenda@localhost:5432/agenda
JWT_SECRET=dev-secret-change-me
JWT_EXPIRES_IN=8h
COOKIE_SECURE=false
```

### 14.3 Desenvolvimento local (fora do Docker)
- `docker compose up db` para subir só o banco.
- Copiar `.env.example` para `.env` na raiz: fora do Docker, `DATABASE_URL` e `JWT_SECRET` são obrigatórias e não têm padrão (seção 11); sem elas a API não sobe.
- `npm install` na raiz; `npm run dev` sobe `shared` (watch), `api` (tsx watch, porta `API_PORT`) e `web` (Vite, porta 5173, proxy `/api → http://localhost:${API_PORT}`).
- A API e o proxy do Vite leem o `.env` da raiz. A porta da API é configurada **somente** por `API_PORT` (padrão 3333); não existe variável `PORT`.

### 14.4 Seed (idempotente; roda a cada subida da API)
- **Usuários** (criados só se o e-mail não existir):
  - Admin: `admin@agenda.com` / `admin123`
  - Cliente: Maria Silva — `maria@email.com` / `cliente123` — telefone `11987654321`
  - Cliente: João Souza — `joao@email.com` / `cliente123` — sem telefone
- **Configuração** (só se não existir; nunca sobrescreve alterações do admin): slot 30 min; seg–sex 09:00–18:00 ativos; sáb 09:00–13:00 ativo; dom inativo (09:00–18:00 guardado).
- **Agendamentos de exemplo** (só se a tabela estiver vazia), relativos à data atual, alinhados aos slots, dentro do expediente e sem sobreposição:
  - 2 passados concluídos (Maria), 1 passado cancelado pelo cliente (João);
  - 3 futuros confirmados nos próximos dias úteis (2 Maria, 1 João);
  - 1 futuro cancelado pelo admin (Maria).
  - Representam histórico: são inseridos direto no banco com `created_at` **anterior** ao `start_at` (como se tivessem sido feitos quando ainda eram futuros), mantendo coerência com a regra de não agendar no passado. Nenhuma rota da API permite criar agendamento no passado.

---

## 15. Frontend

### 15.1 Rotas
| Rota | Acesso | Conteúdo |
|---|---|---|
| `/` | — | Redireciona para `/agendar` |
| `/agendar` | público | Calendário + horários + confirmação (RF-02 a RF-04). Lê `?date=&slot=` |
| `/login`, `/cadastro` | público (logado → redireciona) | Formulários; aceitam `?redirect=` |
| `/meus-agendamentos` | `CLIENT` | Abas Próximos / Histórico (RF-05, RF-06) |
| `/admin` | `ADMIN` | Resumo + abas Agenda / Todos (RF-07 a RF-10) |
| `/admin/configuracoes` | `ADMIN` | Configuração da agenda (RF-11) |

- Guardas de rota por papel: não logado → `/login?redirect=…`; papel errado → página inicial do seu papel.
- Sessão via `GET /auth/me` (TanStack Query): `401` significa "não logado", não é erro exibido. Qualquer `401 UNAUTHENTICATED` em outra requisição (ex.: cookie expirado com a aplicação aberta) zera a sessão no cliente; as guardas então mandam ao login com o `redirect` da página atual, sem toast.
- Cabeçalho: links conforme papel, nome do usuário, "Sair".
- Interface em **português (pt-BR)**; datas formatadas no fuso de negócio com locale `ptBR`.

### 15.2 Componentes-chave
- **`MonthCalendar`** (próprio, com date-fns — sem biblioteca de calendário): grade mensal, navegação entre meses, estado por dia via props (`getDayState`), conteúdo extra por dia (`renderDayContent`, ex.: contagem), modos `single` (clique) e `multi` (clique alterna; clicar e arrastar seleciona intervalo via pointer events). Usado em `/agendar` e na aba Agenda.
- **`SlotGrid`**, **`AppointmentCard`/linha de lista**, **`StatusBadge`** (usa `displayStatus`), **`ConfirmDialog`**.
- Estado do servidor com TanStack Query; após mutações, invalidar as queries afetadas (disponibilidade, calendários, listas, resumo).

---

## 16. Decisões técnicas (resumo para apresentação)

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Agenda única, slots fixos configuráveis (30/60) | Atende o caso com mínima complexidade; modelo guarda `start_at`/`end_at` para suportar mudanças de duração |
| 2 | Disponibilidade calculada sob demanda | Não há slots materializados para sincronizar; mudanças de configuração valem imediatamente |
| 3 | Mesma função gera slots para consulta e valida a reserva | Fonte única de verdade; impossível consultar uma regra e validar outra |
| 4 | Conflito por sobreposição de intervalos, não igualdade | Continua correto quando a duração muda (ex.: 30 → 60) |
| 5 | Duas camadas contra conflito: validação + exclusion constraint | A aplicação dá mensagens claras; o banco garante mesmo sob concorrência |
| 6 | Advisory lock em reserva e bloqueio | Fecha a corrida "reservar enquanto bloqueia", que a constraint não cobre |
| 7 | Status persistido mínimo (`CONFIRMED`/`CANCELLED`) + "Concluído" derivado | Sem jobs para atualizar status; critério único (início do atendimento) |
| 8 | Cancelamento como mudança de estado, sem exclusão | Histórico preservado; sabe-se quem cancelou e quando |
| 9 | UTC no banco (`timestamptz`) + fuso de negócio fixo | Instantes inequívocos; agrupamentos por dia corretos |
| 10 | Horários de configuração como texto `HH:mm` | Legível ponta a ponta; evita armadilhas do tipo `TIME` no Prisma |
| 11 | Contas para clientes, navegação pública | Atende "ver/cancelar meus agendamentos" com segurança; login só ao confirmar |
| 12 | JWT em cookie httpOnly | Token inacessível a JavaScript (XSS); front mais simples |
| 13 | Monorepo com pacote `shared` (Zod) | Mesma validação no front e no back |
| 14 | Express 5 em módulos por domínio + DI | Organização clara; testes com repositórios em memória |
| 15 | Prisma | Tipagem forte, migrations e seed integrados; constraint especial via SQL de migration |
| 16 | Testes com mocks na v1 | Rápidos e sem infraestrutura extra; concorrência verificada por script manual |
| 17 | nginx servindo o front e fazendo proxy da API | Mesma origem: sem CORS, cookies simples |
| 18 | Calendário próprio reutilizado em 2 telas | Evita biblioteca pesada; atende seleção por arraste |
| 19 | Bloquear dia cancela agendamentos (com confirmação); mudar horário semanal não | Bloqueio é ação explícita sobre datas; horário semanal é regra genérica |
| 20 | PostgreSQL com volume nomeado `pgdata` | Dados sobrevivem a reinícios e rebuilds; `docker compose down -v` zera o ambiente |
| 21 | Admin não realiza agendamentos | Pela descrição do projeto, quem agenda é o cliente; o admin recebe e gerencia. Agendar em nome de cliente é melhoria futura |

### Limitações conhecidas (documentar no README na Fase 8)
- **Advisory lock sob carga alta:** reservas e bloqueios são serializados por um único lock. Cada transação ocupa uma conexão do pool enquanto espera. Com dezenas de requisições simultâneas, a espera pode passar do `maxWait` (2 s) ou do `timeout` (5 s) das transações interativas do Prisma. O erro resultante (`P2028`) vira `500 INTERNAL_ERROR`, não `409`. Isso não afeta a consistência, só a resposta. O volume esperado (uma agenda única) fica muito abaixo desse limite.
- **`npm audit` (Prisma 7):** o CLI `prisma` aponta vulnerabilidades altas em dependências transitivas (`deepmerge-ts` via `@prisma/config`, `mysql2`). O CLI só roda migrations e seed. O atendimento das requisições usa `@prisma/client` + `@prisma/adapter-pg`, que não carregam essas dependências. A correção sugerida (`npm audit fix --force`) faz downgrade para o Prisma 6, uma mudança incompatível, e por isso não foi aplicada.

---

## 17. Melhorias futuras
- Antecedência mínima para agendar e para cancelar; limite de datas futuras; limite de agendamentos ativos por cliente.
- Status "Não compareceu" marcado pelo admin.
- Admin criar agendamento em nome de cliente.
- Exceções completas por data (abrir dia fechado, horário especial); bloqueio de parte do dia.
- Vários intervalos por dia (pausa de almoço); mais opções de duração; serviços com durações diferentes; múltiplos profissionais.
- Aviso ao admin quando mudança de configuração deixa agendamentos fora do horário.
- Notificações (e-mail/WhatsApp) de confirmação e cancelamento.
- Refresh token; rate limiting no login; recuperação de senha; edição de perfil.
- Cache da configuração da agenda (se houver necessidade).
- Testes de integração com banco real (incluindo concorrência automatizada) e testes E2E (Playwright).
- Visualização semanal em grade para o admin.
- nginx com usuário não-root.

---

## 18. Testes

### 18.1 Backend (Vitest + Supertest com repositórios em memória)
**Engine de disponibilidade (unitários, `now` sempre injetado):**
1. Dia da semana inativo → nenhum slot.
2. Data bloqueada → nenhum slot.
3. 09:00–12:00 com 30 min → 6 slots; com 60 min → 3 slots.
4. 09:00–10:30 com 60 min → 1 slot (09:00); o restante é descartado.
5. Hoje às 10:10 → primeiro slot disponível 10:30.
6. Agendamento de 30 min às 09:30 + duração alterada para 60 → slot 09:00 indisponível, 10:00 disponível.
7. Agendamento cancelado não ocupa horário.
8. Conversão de fuso: 09:00 em São Paulo = 12:00Z.
9. Estados do mês: `PAST`, `CLOSED`, `BLOCKED`, `AVAILABLE`, `NO_SLOTS` (incluindo hoje sem slots restantes).
10. `getDisplayStatus`: futuro, passado, exatamente em `now`, cancelado.

**Rotas/services (Supertest):**
- Cadastro: cria `CLIENT` ignorando `role`; e-mail normalizado; e-mail duplicado → 409; telefone opcional; telefone inválido → 400.
- Login: senha errada → 401 genérico; sucesso define cookie httpOnly; `/auth/me` sem cookie → 401.
- Agendar: sucesso 201; passado → 422 `SLOT_IN_PAST`; dia fechado/bloqueado/desalinhado → 422 `SLOT_NOT_AVAILABLE`; ocupado → 409; erro de constraint simulado pelo fake → 409.
- Permissões: visitante em `POST /appointments` → 401; admin em `POST /appointments` → 403; cliente em `/admin/*` → 403.
- Cancelar: próprio → 200; de outro cliente → 404; já cancelado → 422; já iniciado → 422; admin cancela qualquer um.
- Bloqueio: cancela futuros confirmados das datas (`cancelledBy = ADMIN`), mantém os já iniciados, data passada → 422; desbloqueio não restaura.
- Configuração: valida duração, formato `:00`/`:30`, `end > start`; salvar não altera agendamentos.
- Formato de erro consistente em todos os casos.

### 18.2 Frontend (Vitest + Testing Library) — poucos testes
- `MonthCalendar`: dias desabilitados conforme estado; seleção por arraste seleciona o intervalo.
- `/agendar`: visitante que clica num horário é enviado para `/login` com `redirect` correto.

### 18.3 Comandos
`npm test` (todos os workspaces), `npm run test -w api`, `npm run test -w web`, `npm run lint`, `npm run typecheck`.

---

## 19. Fases de implementação
Cada fase termina com **lint, typecheck e testes passando** e um commit. Não avançar com fase quebrada.

| Fase | Entregas | Pronto quando |
|---|---|---|
| **0. Fundação** | Workspaces, TS strict, ESLint/Prettier, `shared` (esqueleto + build), API com `/api/health`, web "hello", Dockerfiles, nginx, compose, `.env.example` | `docker compose up --build` exibe a página e `/api/health` responde via `localhost:3000` |
| **1. Dados e auth** | Schema Prisma, migrations (incl. constraints manuais), seed de usuários e configuração, `env.ts`, erros, `validate`, `errorHandler`, módulo `auth` com cookie, middlewares de papel, DI/`createApp`, fakes de teste | Testes de auth passando; seed idempotente |
| **2. Disponibilidade** | Engine pura + testes; `getScheduleConfig`; rotas públicas de calendário e horários | Testes do engine passando |
| **3. Agendamentos** | `TransactionManager` com advisory lock, criar/listar/cancelar, `prisma-errors`, script de concorrência | Testes passando; script retorna uma 201 e uma 409 |
| **4. Admin (backend)** | Resumo, calendário com contagens, lista filtrada/paginada, cancelamento admin, schedule GET/PUT, bloquear/desbloquear; agendamentos de exemplo no seed | Testes passando |
| **5. Frontend base** | Tailwind + shadcn, router, layout/cabeçalho, cliente HTTP + `ApiError`, contexto de sessão (`/auth/me`), guardas, login/cadastro com `redirect` | Login/logout funcionando para os dois papéis |
| **6. Telas do cliente** | `MonthCalendar`, `SlotGrid`, fluxo `/agendar` (incl. retorno do login), `/meus-agendamentos` | Fluxo completo de agendar e cancelar no navegador |
| **7. Telas do admin** | Resumo, aba Agenda (visualização + modo bloqueio), aba Todos, Configurações | Todas as RFs do admin funcionando |
| **8. Acabamento** | Testes de frontend (inclui os testes de componente da seção 18.2 — `MonthCalendar` e redirect do visitante em `/agendar` — com jsdom + Testing Library; até a Fase 7 o front testa só lógica pura em ambiente `node`), README (como rodar, credenciais, decisões, verificação de concorrência), revisão contra a seção 20, teste do zero com `docker compose down -v && docker compose up --build` | Checklist da seção 20 completo |

---

## 20. Checklist de aceitação final
- [ ] `docker compose up --build` sobe tudo do zero (sem `.env`) e a aplicação abre em `localhost:3000`.
- [ ] Credenciais do seed funcionam; seed pode rodar repetidamente sem duplicar dados nem sobrescrever configuração.
- [ ] Visitante vê calendário e horários sem login; ao escolher horário, faz login/cadastro e volta para confirmar.
- [ ] Não é possível agendar no passado, em dia fechado, bloqueado, fora do expediente ou em horário desalinhado.
- [ ] Duas reservas simultâneas no mesmo horário: uma 201, uma 409 (script de verificação).
- [ ] Cliente vê Próximos/Histórico e cancela apenas os próprios agendamentos futuros.
- [ ] Admin vê resumo, calendário com contagens, lista com filtros e paginação, e cancela agendamentos.
- [ ] Admin altera duração e horário semanal; agendamentos existentes permanecem.
- [ ] Admin bloqueia dias (com confirmação e cancelamento dos agendamentos afetados) e desbloqueia.
- [ ] Datas e contagens corretas no fuso de São Paulo (inclusive agendamentos após 21:00).
- [ ] Todas as respostas de erro seguem o formato padrão; nenhuma rota retorna stack trace.
- [ ] Lint, typecheck e testes passando.
- [ ] README explica como rodar, credenciais e principais decisões (seção 16).
