# OQU — образовательная AI-платформа (дизайн NOMAD NIGHT)

Production-фундамент новой платформы: премиальная тёмная тема **NOMAD NIGHT**,
студенческий кабинет с каталогом курсов, геймификацией и AI-наставником.
«OQU» — рабочее название (плейсхолдер бренда).

## Стек

| Слой | Технология |
|---|---|
| Framework | **Next.js 16** (App Router, RSC, Turbopack) |
| Язык | **TypeScript** (strict) |
| Стили | **Tailwind CSS v4** (design-токены в `globals.css`) |
| Иконки | lucide-react |
| Шрифты | Manrope + JetBrains Mono (`next/font`, сабсеты latin + **cyrillic**) |
| БД / ORM | **Postgres** + **Drizzle ORM** (`postgres-js`) |
| Иконки/утилиты | clsx + tailwind-merge |

## Быстрый старт

```bash
pnpm install
pnpm dev
```

Открыть <http://localhost:3000>. Без `DATABASE_URL` приложение работает на
встроенных seed-данных (слой `src/data/*`).

## База данных (Postgres)

Схема описана в `src/db/schema.ts` (Drizzle). Начальная миграция —
`drizzle/0000_init.sql`.

```bash
cp .env.example .env.local        # укажите DATABASE_URL (Neon / Supabase / локальный PG)
pnpm db:generate                  # сгенерировать миграцию из схемы
pnpm db:migrate                   # применить миграции
pnpm db:studio                    # веб-интерфейс Drizzle Studio
```

Подключение живой БД — это замена реализации в `src/data/*` (контракт типов
`src/types` не меняется, UI переписывать не нужно).

## Архитектура кода

```
src/
  app/
    layout.tsx            # шрифты, метаданные, тема
    globals.css           # дизайн-токены NOMAD NIGHT (@theme) + база
    (app)/                # авторизованная зона (общая оболочка)
      layout.tsx          # AppShell (сайдбар + топбар + контент)
      page.tsx            # дашборд / каталог курсов
      mentor|achievements|leaderboard|store|profile/  # разделы
      course/[slug]/      # страница курса (async params — Next 16)
  components/
    ui/                   # Card, Badge, ProgressBar, ProgressRing
    layout/               # Brand, Sidebar, Topbar, MobileDrawer, AppShell
    dashboard/            # Hero, CourseCard, StatsStrip, AiMentorCard, ...
  data/                   # слой доступа к данным (seed → Postgres)
  db/                     # Drizzle schema + клиент
  lib/                    # utils (cn, форматирование, плюрализация), nav
  types/                  # доменные типы
```

## Дизайн-система (NOMAD NIGHT)

- Тема — осознанно тёмная. Фон `#111218`, тёплое золото `#F5A524`, бирюза `#2DD4BF`.
- Токены — CSS-переменные в `@theme` (`globals.css`); в компонентах используются
  как Tailwind-утилиты (`bg-surface`, `text-gold`, `border-line`, `font-display`).
- Доступность: видимый фокус, `aria`, поддержка `prefers-reduced-motion`.
- Полностью адаптивно: сайдбар → выезжающее меню на мобильных.

## Реализовано (Фаза 1)

- Дизайн-система NOMAD NIGHT + шрифты с кириллицей.
- Адаптивная оболочка: сайдбар (десктоп) + drawer (мобайл, Esc/overlay/фокус-лок).
- Дашборд: герой, статистика, каталог курсов (доступ full/locked/флагман),
  правый рейл (AI-наставник, уровень/XP, миссия дня).
- Заглушки разделов и страница курса (без битых ссылок).
- Postgres-схема (Drizzle) + миграция + скрипты.

## Дальше (следующие фазы)

Аутентификация (Auth.js) и RLS · подключение живой Postgres · страница курса
(модули/уроки, видеоплеер, прогресс-гейтинг 80%) · чат AI-наставника · экраны
геймификации · админка · онбординг. См. `../TZ-platform.md`.

## Скрипты

```bash
pnpm dev          # dev-сервер (Turbopack)
pnpm build        # production-сборка
pnpm start        # запуск production-сборки
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm db:generate  # миграции из схемы
pnpm db:migrate   # применить миграции
pnpm db:studio    # Drizzle Studio
```
