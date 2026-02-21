# Diced Dashboard — Briefing

## Visão Geral

Dashboard interno da Diced para acompanhar o andamento dos apps, status na Play Store, métricas do AdMob e outros indicadores do negócio.

**URL:** `app.diced.com.br`

## Contexto

- A Diced (`diced.com.br`) é uma empresa de desenvolvimento de apps
- O site atual é uma landing page pública (React + Vite + Tailwind) — projeto separado
- O dashboard é uma ferramenta **interna/privada** com autenticação
- O design deve manter consistência visual com a landing (cores violet/pink, fontes Syne/DM Sans, dark theme)

## Funcionalidades Planejadas

### MVP

- [ ] Autenticação (login protegido)
- [ ] Lista de apps com status geral (publicado, em review, suspenso, etc.)
- [ ] Integração com Google Play Developer API (status, ratings, downloads)
- [ ] Integração com AdMob API (receita, impressões, eCPM)
- [ ] Dashboard com cards/gráficos resumindo métricas principais

### Futuro

- [ ] Notificações (app removido, queda de receita, review negativo)
- [ ] Histórico de métricas ao longo do tempo
- [ ] Múltiplos usuários/permissões
- [ ] Integração com Firebase (crashes, analytics)
- [ ] Integração com App Store Connect (se expandir pra iOS)

## Stack Sugerida

| Camada         | Tecnologia                          |
|----------------|-------------------------------------|
| Framework      | Next.js (App Router)                |
| Styling        | Tailwind CSS (mesma paleta da landing) |
| Auth           | NextAuth.js ou Clerk                |
| HTTP Client    | Fetch / Axios                       |
| Charts         | Recharts ou Chart.js                |
| Database       | PostgreSQL (Supabase) ou Firebase   |
| Deploy         | Vercel                              |

## Design Tokens (da Landing)

```
Cores:
  violet-500: #8B5CF6
  violet-600: #7C3AED
  pink-500:   #EC4899
  surface:    #111118
  surface-2:  #1B1B26

Fontes:
  Headings: Syne
  Body:     DM Sans
```

## APIs Relevantes

- **Google Play Developer API** — status de publicação, ratings, downloads
- **AdMob API** — receita, impressões, eCPM, mediação
- **Firebase Admin SDK** — crashlytics, analytics (futuro)

## Estrutura de Subdomínio

```
diced.com.br       → Landing page (projeto atual, deploy estático)
app.diced.com.br   → Dashboard (projeto novo, Vercel com Next.js)
```

Configurar CNAME ou A record no DNS apontando `app.diced.com.br` para o deploy do dashboard.
