# App Pipeline (Esteira de Produção) — Design

## Summary

Kanban board for tracking apps through the production pipeline. New page at `/pipeline` with 6 fixed stages, drag-free UI (button-driven advancement), and a 14-day countdown timer for the closed testing stage.

## Pipeline Stages (fixed)

| # | Stage           | Key            | Description                        |
|---|-----------------|----------------|------------------------------------|
| 1 | Código          | `code`         | App being developed                |
| 2 | Play Store      | `play_store`   | Publishing to Play Store           |
| 3 | Testers         | `testers`      | Recruiting testers                 |
| 4 | Teste Fechado   | `closed_test`  | 14-day closed testing (countdown)  |
| 5 | Banners AdMob   | `admob_banners`| Creating AdMob ad units            |
| 6 | Versão com Ads  | `ads_version`  | Final version with monetization    |

## Database

New table `pipeline_apps` (separate from `apps` — different context):

```sql
CREATE TABLE pipeline_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  package_name TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'code',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_pipeline_apps_user ON pipeline_apps (user_id);
```

- `stage`: one of the 6 stage keys
- `stage_entered_at`: updates every time stage changes (used for countdown)
- `completed_at`: set when app finishes last stage

## UI

### Page: `/pipeline`

- Header: "Esteira de Produção"
- "Novo App" button top-right opens modal (name, package_name, icon URL)
- 6 columns displayed horizontally (scrollable on mobile)
- Each column shows stage name + count badge
- Cards inside each column show: icon, name, package_name
- "Teste Fechado" cards show countdown: "Dia X/14 — faltam Y dias"
- Each card has "Avançar" button to move to next stage
- Last stage cards have "Concluir" button

### Sidebar

New nav item between "Aplicativos" and "Receita":
- Label: "Pipeline"
- Icon: Heroicons `ArrowsRightLeft` or similar flow icon

## API Routes

- `GET /api/pipeline` — list all pipeline apps for user
- `POST /api/pipeline` — create new pipeline app
- `PATCH /api/pipeline/[id]` — update stage (advance/edit)
- `DELETE /api/pipeline/[id]` — remove app from pipeline

## Components

- `pipeline-board.tsx` — client component with kanban layout
- `pipeline-card.tsx` — individual app card with actions
- `new-pipeline-app-modal.tsx` — creation modal
