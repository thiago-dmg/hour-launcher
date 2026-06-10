# Hour Launcher MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o MVP do Hour Launcher como uma CLI TypeScript que planeja e, após revisão, lança 8 horas diárias no Azure DevOps + 7pace.

**Architecture:** A CLI carrega JSON de configuração e atividades, busca contexto no Azure DevOps, calcula alocações com um core de domínio testável e usa Playwright para autenticação/leitura/escrita no 7pace. O MVP prioriza uma execução por dia, revisão obrigatória e prevenção básica de duplicidade.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, Zod, Commander, Playwright, Azure DevOps REST API.

---

## Estrutura de Arquivos

- Criar `package.json`: scripts, dependências e configuração ESM.
- Criar `tsconfig.json`: compilação TypeScript.
- Criar `vitest.config.ts`: testes unitários.
- Criar `.gitignore`: segredos, auth state, build e node_modules.
- Criar `config/hour-launcher.example.json`: configuração documentada.
- Criar `config/activities.example.json`: exemplo de atividades.
- Criar `src/types/domain.ts`: tipos centrais.
- Criar `src/allocation/time-math.ts`: parsing/formatação/soma de tempo.
- Criar `src/allocation/opex-mapper.ts`: mapeamento OPEX.
- Criar `src/allocation/duplicate-policy.ts`: decisão de update/skip/fail.
- Criar `src/allocation/allocation-engine.ts`: cálculo final das 8 horas.
- Criar `src/config/schema.ts`: schemas Zod.
- Criar `src/config/config-loader.ts`: leitura e validação de JSON.
- Criar `src/review/review-renderer.ts`: saída do modo revisão.
- Criar `src/review/confirmation.ts`: confirmação no terminal.
- Criar `src/azure-devops/azure-devops-client.ts`: client REST.
- Criar `src/azure-devops/work-item-service.ts`: descoberta de US.
- Criar `src/azure-devops/sprint-service.ts`: sprint atual.
- Criar `src/sevenpace/selectors.ts`: seletores centralizados.
- Criar `src/sevenpace/sevenpace-playwright.ts`: browser/session.
- Criar `src/sevenpace/time-entry-reader.ts`: leitura de entradas.
- Criar `src/sevenpace/time-entry-writer.ts`: escrita/atualização.
- Criar `src/storage/run-log-store.ts`: log local de execução.
- Criar `src/cli/index.ts`: entrypoint.
- Criar `src/cli/commands/plan-day.ts`: comando de planejamento.
- Criar `src/cli/commands/launch-day.ts`: comando de lançamento.
- Criar `src/cli/commands/auth-sevenpace.ts`: comando para salvar sessão.
- Criar `tests/allocation/time-math.test.ts`.
- Criar `tests/allocation/opex-mapper.test.ts`.
- Criar `tests/allocation/allocation-engine.test.ts`.
- Criar `tests/allocation/duplicate-policy.test.ts`.
- Criar `tests/config/config-loader.test.ts`.

---

### Task 1: Scaffold do Projeto

**Files:**
- Criar: `package.json`
- Criar: `tsconfig.json`
- Criar: `vitest.config.ts`
- Criar: `.gitignore`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "hour-launcher",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "plan-day": "tsx src/cli/index.ts plan-day",
    "launch-day": "tsx src/cli/index.ts launch-day",
    "auth:sevenpace": "tsx src/cli/index.ts auth-sevenpace"
  },
  "dependencies": {
    "@playwright/test": "^1.44.0",
    "commander": "^12.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true
  }
});
```

- [ ] **Step 4: Criar `.gitignore`**

```gitignore
node_modules/
dist/
.auth/
.runs/
config/hour-launcher.json
config/activities.local.json
.env
playwright-report/
test-results/
```

- [ ] **Step 5: Instalar dependências**

Run: `npm install`

Expected: `package-lock.json` criado e instalação sem erros.

- [ ] **Step 6: Validar scaffold**

Run: `npm run build`

Expected: build falha porque ainda não há arquivos `src`, ou passa após as próximas tasks. Não usar essa falha como bug antes da Task 2.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold typescript project"
```

---

### Task 2: Tipos de Domínio e Matemática de Tempo

**Files:**
- Criar: `src/types/domain.ts`
- Criar: `src/allocation/time-math.ts`
- Criar: `tests/allocation/time-math.test.ts`

- [ ] **Step 1: Escrever teste de matemática de tempo**

```ts
import { describe, expect, it } from "vitest";
import { formatMinutes, parseHourText, sumMinutes } from "../../src/allocation/time-math.js";

describe("time-math", () => {
  it("formata minutos como horas e minutos", () => {
    expect(formatMinutes(30)).toBe("0h30");
    expect(formatMinutes(480)).toBe("8h00");
    expect(formatMinutes(75)).toBe("1h15");
  });

  it("interpreta texto de horas", () => {
    expect(parseHourText("0h30")).toBe(30);
    expect(parseHourText("1h00")).toBe(60);
    expect(parseHourText("7h30")).toBe(450);
  });

  it("soma listas de minutos", () => {
    expect(sumMinutes([{ minutes: 30 }, { minutes: 60 }, { minutes: 390 }])).toBe(480);
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `npm test -- tests/allocation/time-math.test.ts`

Expected: FAIL com erro de módulo inexistente.

- [ ] **Step 3: Criar `src/types/domain.ts`**

```ts
export type WorkItemId = number;

export type ActivityInput = {
  type: string;
  minutes: number;
  description: string;
  workItemId?: WorkItemId;
};

export type DayActivityFile = {
  date: string;
  activities: ActivityInput[];
};

export type OpexRule = {
  label: string;
  workItemId?: WorkItemId;
  featureId?: WorkItemId;
  createUserStory?: boolean;
};

export type HourLauncherConfig = {
  azureDevOps: {
    orgUrl: string;
    project: string;
    authMethod: "azure-cli" | "azure-identity" | "pat";
    defaultTeam: string | null;
  };
  sevenPace: {
    baseUrl: string;
    mode: "playwright";
    headless: boolean;
  };
  time: {
    dailyTargetMinutes: number;
    defaultDailyMinutes: number;
    minimumEntryMinutes: number;
  };
  defaults: {
    dailyWorkItemId: WorkItemId;
    capexStrategy: "activeAssignedUserStory";
  };
  opexRules: Record<string, OpexRule>;
  duplicatePolicy: {
    sameDateSameWorkItem: "update" | "skip" | "fail";
    allowMultipleEntriesSameWorkItem: boolean;
    validateFinalTotal: boolean;
  };
};

export type WorkItemSummary = {
  id: WorkItemId;
  title: string;
  state: string;
  assignedTo?: string;
  workItemType: string;
};

export type PlannedEntry = {
  date: string;
  label: string;
  workItemId: WorkItemId;
  minutes: number;
  description: string;
  category: "CAPEX" | "OPEX";
  source: "daily" | "activity" | "remainder";
};
```

- [ ] **Step 4: Criar `src/allocation/time-math.ts`**

```ts
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new Error(`Minutos invalidos: ${totalMinutes}`);
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

export function parseHourText(text: string): number {
  const match = /^(\d+)h([0-5]\d)$/.exec(text.trim());
  if (!match) {
    throw new Error(`Formato de hora invalido: ${text}`);
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function sumMinutes(items: Array<{ minutes: number }>): number {
  return items.reduce((total, item) => total + item.minutes, 0);
}
```

- [ ] **Step 5: Rodar teste**

Run: `npm test -- tests/allocation/time-math.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/domain.ts src/allocation/time-math.ts tests/allocation/time-math.test.ts
git commit -m "feat: add time math domain primitives"
```

---

### Task 3: Schemas e Configuração JSON

**Files:**
- Criar: `config/hour-launcher.example.json`
- Criar: `config/activities.example.json`
- Criar: `src/config/schema.ts`
- Criar: `src/config/config-loader.ts`
- Criar: `tests/config/config-loader.test.ts`

- [ ] **Step 1: Criar exemplos JSON**

`config/hour-launcher.example.json`:

```json
{
  "azureDevOps": {
    "orgUrl": "https://dev.azure.com/dotzmkt",
    "project": "NOME_DO_PROJETO",
    "authMethod": "azure-cli",
    "defaultTeam": null
  },
  "sevenPace": {
    "baseUrl": "https://dev.azure.com/dotzmkt",
    "mode": "playwright",
    "headless": false
  },
  "time": {
    "dailyTargetMinutes": 480,
    "defaultDailyMinutes": 30,
    "minimumEntryMinutes": 15
  },
  "defaults": {
    "dailyWorkItemId": 171055,
    "capexStrategy": "activeAssignedUserStory"
  },
  "opexRules": {
    "sustentacao": { "label": "Sustentacao", "featureId": 171057, "createUserStory": true },
    "tarefa": { "label": "Tarefa", "featureId": 171058, "createUserStory": true },
    "refactorManutencao": { "label": "Refactor / Manutencao", "featureId": 171466, "createUserStory": true },
    "treinamentoFeedbackReuniaoCorporativa": { "label": "Treinamento / Feedback / Reuniao corporativa", "workItemId": 171056 },
    "refinamentoPlanejamentoDaily": { "label": "Refinamento / Planejamento / Daily", "workItemId": 171055 },
    "reunioes": { "label": "Reunioes", "workItemId": 171054 },
    "dlqs": { "label": "DLQs", "workItemId": 171802 },
    "glpi": { "label": "Chamados GLPI", "workItemId": 171804 }
  },
  "duplicatePolicy": {
    "sameDateSameWorkItem": "update",
    "allowMultipleEntriesSameWorkItem": false,
    "validateFinalTotal": true
  }
}
```

`config/activities.example.json`:

```json
{
  "date": "2026-06-10",
  "activities": [
    {
      "type": "reunioes",
      "minutes": 30,
      "description": "Alinhamento tecnico"
    }
  ]
}
```

- [ ] **Step 2: Escrever teste de configuração**

```ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadActivityFile, loadConfig } from "../../src/config/config-loader.js";

describe("config-loader", () => {
  it("carrega configuracao valida", async () => {
    const dir = join(tmpdir(), `hour-launcher-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify({
      azureDevOps: { orgUrl: "https://dev.azure.com/dotzmkt", project: "P", authMethod: "azure-cli", defaultTeam: null },
      sevenPace: { baseUrl: "https://dev.azure.com/dotzmkt", mode: "playwright", headless: false },
      time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
      defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory" },
      opexRules: { reunioes: { label: "Reunioes", workItemId: 171054 } },
      duplicatePolicy: { sameDateSameWorkItem: "update", allowMultipleEntriesSameWorkItem: false, validateFinalTotal: true }
    }));

    await expect(loadConfig(path)).resolves.toMatchObject({ azureDevOps: { project: "P" } });
    await rm(dir, { recursive: true, force: true });
  });

  it("carrega arquivo de atividades", async () => {
    const dir = join(tmpdir(), `hour-launcher-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "activities.json");
    await writeFile(path, JSON.stringify({ date: "2026-06-10", activities: [{ type: "reunioes", minutes: 30, description: "Sync" }] }));

    await expect(loadActivityFile(path)).resolves.toMatchObject({ date: "2026-06-10" });
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Rodar teste e confirmar falha**

Run: `npm test -- tests/config/config-loader.test.ts`

Expected: FAIL com módulo inexistente.

- [ ] **Step 4: Criar `src/config/schema.ts`**

```ts
import { z } from "zod";

export const configSchema = z.object({
  azureDevOps: z.object({
    orgUrl: z.string().url(),
    project: z.string().min(1),
    authMethod: z.enum(["azure-cli", "azure-identity", "pat"]),
    defaultTeam: z.string().min(1).nullable()
  }),
  sevenPace: z.object({
    baseUrl: z.string().url(),
    mode: z.literal("playwright"),
    headless: z.boolean()
  }),
  time: z.object({
    dailyTargetMinutes: z.number().int().positive(),
    defaultDailyMinutes: z.number().int().nonnegative(),
    minimumEntryMinutes: z.number().int().positive()
  }),
  defaults: z.object({
    dailyWorkItemId: z.number().int().positive(),
    capexStrategy: z.literal("activeAssignedUserStory")
  }),
  opexRules: z.record(z.object({
    label: z.string().min(1),
    workItemId: z.number().int().positive().optional(),
    featureId: z.number().int().positive().optional(),
    createUserStory: z.boolean().optional()
  })),
  duplicatePolicy: z.object({
    sameDateSameWorkItem: z.enum(["update", "skip", "fail"]),
    allowMultipleEntriesSameWorkItem: z.boolean(),
    validateFinalTotal: z.boolean()
  })
});

export const activityFileSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activities: z.array(z.object({
    type: z.string().min(1),
    minutes: z.number().int().positive(),
    description: z.string().min(1),
    workItemId: z.number().int().positive().optional()
  }))
});
```

- [ ] **Step 5: Criar `src/config/config-loader.ts`**

```ts
import { readFile } from "node:fs/promises";
import type { DayActivityFile, HourLauncherConfig } from "../types/domain.js";
import { activityFileSchema, configSchema } from "./schema.js";

async function readJson(path: string): Promise<unknown> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content);
}

export async function loadConfig(path = "config/hour-launcher.json"): Promise<HourLauncherConfig> {
  return configSchema.parse(await readJson(path)) as HourLauncherConfig;
}

export async function loadActivityFile(path: string): Promise<DayActivityFile> {
  return activityFileSchema.parse(await readJson(path)) as DayActivityFile;
}
```

- [ ] **Step 6: Rodar teste**

Run: `npm test -- tests/config/config-loader.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add config src/config tests/config
git commit -m "feat: add json configuration loading"
```

---

### Task 4: Mapeamento OPEX

**Files:**
- Criar: `src/allocation/opex-mapper.ts`
- Criar: `tests/allocation/opex-mapper.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
import { describe, expect, it } from "vitest";
import { mapOpexActivity } from "../../src/allocation/opex-mapper.js";
import type { HourLauncherConfig } from "../../src/types/domain.js";

const config = {
  opexRules: {
    reunioes: { label: "Reunioes", workItemId: 171054 },
    sustentacao: { label: "Sustentacao", featureId: 171057, createUserStory: true }
  }
} as HourLauncherConfig;

describe("opex-mapper", () => {
  it("mapeia atividade OPEX com US fixa", () => {
    expect(mapOpexActivity({ type: "reunioes", minutes: 30, description: "Sync" }, config)).toEqual({
      kind: "mapped",
      label: "Reunioes",
      workItemId: 171054
    });
  });

  it("usa workItemId informado quando a regra exige criacao futura de US", () => {
    expect(mapOpexActivity({ type: "sustentacao", minutes: 60, description: "Suporte", workItemId: 200001 }, config)).toEqual({
      kind: "mapped",
      label: "Sustentacao",
      workItemId: 200001
    });
  });

  it("falha quando regra exige criacao futura de US sem workItemId", () => {
    expect(() => mapOpexActivity({ type: "sustentacao", minutes: 60, description: "Suporte" }, config))
      .toThrow("exige um workItemId concreto");
  });

  it("retorna CAPEX para tipo nao configurado", () => {
    expect(mapOpexActivity({ type: "desenvolvimento", minutes: 60, description: "Dev" }, config)).toEqual({ kind: "capex" });
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `npm test -- tests/allocation/opex-mapper.test.ts`

Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Criar implementação**

```ts
import type { ActivityInput, HourLauncherConfig, WorkItemId } from "../types/domain.js";

export type OpexMappingResult =
  | { kind: "mapped"; label: string; workItemId: WorkItemId }
  | { kind: "capex" };

export function mapOpexActivity(activity: ActivityInput, config: HourLauncherConfig): OpexMappingResult {
  const rule = config.opexRules[activity.type];

  if (!rule) {
    return { kind: "capex" };
  }

  if (rule.workItemId) {
    return { kind: "mapped", label: rule.label, workItemId: rule.workItemId };
  }

  if (activity.workItemId) {
    return { kind: "mapped", label: rule.label, workItemId: activity.workItemId };
  }

  throw new Error(`A atividade '${activity.type}' exige um workItemId concreto no MVP.`);
}
```

- [ ] **Step 4: Rodar teste**

Run: `npm test -- tests/allocation/opex-mapper.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/allocation/opex-mapper.ts tests/allocation/opex-mapper.test.ts
git commit -m "feat: add opex activity mapping"
```

---

### Task 5: Engine de Alocação

**Files:**
- Criar: `src/allocation/allocation-engine.ts`
- Criar: `tests/allocation/allocation-engine.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
import { describe, expect, it } from "vitest";
import { planDay } from "../../src/allocation/allocation-engine.js";
import type { HourLauncherConfig, WorkItemSummary } from "../../src/types/domain.js";

const config = {
  time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
  defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory" },
  opexRules: {
    reunioes: { label: "Reunioes", workItemId: 171054 }
  }
} as HourLauncherConfig;

const capexWorkItem: WorkItemSummary = {
  id: 172980,
  title: "Implementar feature principal",
  state: "Active",
  workItemType: "User Story"
};

describe("allocation-engine", () => {
  it("inclui Daily e coloca restante em CAPEX", () => {
    const result = planDay({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItem
    });

    expect(result.totalMinutes).toBe(480);
    expect(result.entries).toEqual([
      expect.objectContaining({ label: "Daily", workItemId: 171055, minutes: 30, category: "OPEX" }),
      expect.objectContaining({ label: "US 172980", workItemId: 172980, minutes: 450, category: "CAPEX" })
    ]);
  });

  it("compensa atividades OPEX removendo do CAPEX", () => {
    const result = planDay({
      date: "2026-06-10",
      activities: [{ type: "reunioes", minutes: 30, description: "Sync" }],
      config,
      capexWorkItem
    });

    expect(result.totalMinutes).toBe(480);
    expect(result.entries.map((entry) => [entry.label, entry.minutes])).toEqual([
      ["Daily", 30],
      ["Reunioes", 30],
      ["US 172980", 420]
    ]);
  });

  it("falha quando atividades excedem a meta", () => {
    expect(() => planDay({
      date: "2026-06-10",
      activities: [{ type: "reunioes", minutes: 480, description: "Dia inteiro" }],
      config,
      capexWorkItem
    })).toThrow("excedem a meta diaria");
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `npm test -- tests/allocation/allocation-engine.test.ts`

Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Criar implementação**

```ts
import type { ActivityInput, HourLauncherConfig, PlannedEntry, WorkItemSummary } from "../types/domain.js";
import { mapOpexActivity } from "./opex-mapper.js";
import { sumMinutes } from "./time-math.js";

export type PlanDayInput = {
  date: string;
  activities: ActivityInput[];
  config: HourLauncherConfig;
  capexWorkItem: WorkItemSummary;
};

export type DayPlan = {
  date: string;
  entries: PlannedEntry[];
  totalMinutes: number;
};

export function planDay(input: PlanDayInput): DayPlan {
  const entries: PlannedEntry[] = [
    {
      date: input.date,
      label: "Daily",
      workItemId: input.config.defaults.dailyWorkItemId,
      minutes: input.config.time.defaultDailyMinutes,
      description: "Daily",
      category: "OPEX",
      source: "daily"
    }
  ];

  for (const activity of input.activities) {
    const mapping = mapOpexActivity(activity, input.config);

    if (mapping.kind === "mapped") {
      entries.push({
        date: input.date,
        label: mapping.label,
        workItemId: mapping.workItemId,
        minutes: activity.minutes,
        description: activity.description,
        category: "OPEX",
        source: "activity"
      });
    } else {
      entries.push({
        date: input.date,
        label: `US ${input.capexWorkItem.id}`,
        workItemId: input.capexWorkItem.id,
        minutes: activity.minutes,
        description: activity.description,
        category: "CAPEX",
        source: "activity"
      });
    }
  }

  const usedMinutes = sumMinutes(entries);
  const remainder = input.config.time.dailyTargetMinutes - usedMinutes;

  if (remainder < 0) {
    throw new Error("As atividades excedem a meta diaria.");
  }

  if (remainder > 0) {
    entries.push({
      date: input.date,
      label: `US ${input.capexWorkItem.id}`,
      workItemId: input.capexWorkItem.id,
      minutes: remainder,
      description: input.capexWorkItem.title,
      category: "CAPEX",
      source: "remainder"
    });
  }

  const totalMinutes = sumMinutes(entries);
  if (totalMinutes !== input.config.time.dailyTargetMinutes) {
    throw new Error(`Total planejado invalido: ${totalMinutes}`);
  }

  return { date: input.date, entries, totalMinutes };
}
```

- [ ] **Step 4: Rodar teste**

Run: `npm test -- tests/allocation/allocation-engine.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/allocation/allocation-engine.ts tests/allocation/allocation-engine.test.ts
git commit -m "feat: add day allocation engine"
```

---

### Task 6: Política de Duplicidade

**Files:**
- Criar: `src/allocation/duplicate-policy.ts`
- Criar: `tests/allocation/duplicate-policy.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
import { describe, expect, it } from "vitest";
import { decideDuplicateAction } from "../../src/allocation/duplicate-policy.js";

describe("duplicate-policy", () => {
  it("cria quando nao ha entrada existente", () => {
    expect(decideDuplicateAction({ existingCount: 0, configuredAction: "update" })).toBe("create");
  });

  it("atualiza quando existe uma entrada e politica e update", () => {
    expect(decideDuplicateAction({ existingCount: 1, configuredAction: "update" })).toBe("update");
  });

  it("falha quando existem multiplas entradas ambiguas", () => {
    expect(decideDuplicateAction({ existingCount: 2, configuredAction: "update" })).toBe("fail");
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `npm test -- tests/allocation/duplicate-policy.test.ts`

Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Criar implementação**

```ts
export type DuplicateAction = "create" | "update" | "skip" | "fail";

export function decideDuplicateAction(input: {
  existingCount: number;
  configuredAction: "update" | "skip" | "fail";
}): DuplicateAction {
  if (input.existingCount === 0) {
    return "create";
  }

  if (input.existingCount > 1) {
    return "fail";
  }

  return input.configuredAction;
}
```

- [ ] **Step 4: Rodar teste**

Run: `npm test -- tests/allocation/duplicate-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/allocation/duplicate-policy.ts tests/allocation/duplicate-policy.test.ts
git commit -m "feat: add duplicate policy"
```

---

### Task 7: Revisão no Terminal

**Files:**
- Criar: `src/review/review-renderer.ts`
- Criar: `src/review/confirmation.ts`

- [ ] **Step 1: Criar `review-renderer.ts`**

```ts
import type { PlannedEntry } from "../types/domain.js";
import { formatMinutes, sumMinutes } from "../allocation/time-math.js";

export function renderReview(date: string, entries: PlannedEntry[]): string {
  const lines = [`Data: ${date}`, ""];

  for (const entry of entries) {
    const category = entry.category === "CAPEX" ? "CAPEX" : `US ${entry.workItemId}`;
    lines.push(`${entry.label}: ${formatMinutes(entry.minutes)} -> ${category}`);
  }

  lines.push("");
  lines.push(`Total: ${formatMinutes(sumMinutes(entries))}`);
  lines.push("");
  lines.push("Confirmar? (Sim/Nao)");

  return lines.join("\n");
}
```

- [ ] **Step 2: Criar `confirmation.ts`**

```ts
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function confirmReview(question = "Confirmar? (Sim/Nao) "): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "sim" || answer === "s" || answer === "yes" || answer === "y";
  } finally {
    rl.close();
  }
}
```

- [ ] **Step 3: Rodar build**

Run: `npm run build`

Expected: PASS se tasks anteriores estiverem implementadas.

- [ ] **Step 4: Commit**

```bash
git add src/review
git commit -m "feat: add terminal review rendering"
```

---

### Task 8: Azure DevOps REST Client

**Files:**
- Criar: `src/azure-devops/azure-devops-client.ts`
- Criar: `src/azure-devops/work-item-service.ts`
- Criar: `src/azure-devops/sprint-service.ts`

- [ ] **Step 1: Criar client REST**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HourLauncherConfig } from "../types/domain.js";

const execFileAsync = promisify(execFile);

export class AzureDevOpsClient {
  constructor(private readonly config: HourLauncherConfig["azureDevOps"]) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(this.url(path), {
      headers: await this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps GET falhou ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  async getProjectRelative<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.orgUrl}/${this.config.project}/${path}`, {
      headers: await this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps GET falhou ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(this.url(path), {
      method: "POST",
      headers: {
        ...(await this.authHeaders()),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps POST falhou ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  private url(path: string): string {
    return `${this.config.orgUrl}/${this.config.project}/_apis/${path}`;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (this.config.authMethod === "pat") {
      const pat = process.env.AZURE_DEVOPS_PAT;
      if (!pat) {
        throw new Error("AZURE_DEVOPS_PAT nao configurado.");
      }
      return { Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}` };
    }

    const { stdout } = await execFileAsync("az", ["account", "get-access-token", "--resource", "499b84ac-1321-427f-aa17-267ca6975798", "--query", "accessToken", "-o", "tsv"]);
    return { Authorization: `Bearer ${stdout.trim()}` };
  }
}
```

- [ ] **Step 2: Criar `work-item-service.ts`**

```ts
import type { WorkItemSummary } from "../types/domain.js";
import { AzureDevOpsClient } from "./azure-devops-client.js";

type WiqlResponse = { workItems: Array<{ id: number }> };
type WorkItemsResponse = {
  value: Array<{
    id: number;
    fields: Record<string, unknown>;
  }>;
};

export class WorkItemService {
  constructor(private readonly client: AzureDevOpsClient) {}

  async findActiveAssignedUserStories(): Promise<WorkItemSummary[]> {
    const wiql = {
      query: `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.AssignedTo] = @Me
          AND [System.WorkItemType] = 'User Story'
          AND [System.State] IN ('Active', 'Resolved', 'New')
        ORDER BY [System.ChangedDate] DESC
      `
    };

    const result = await this.client.post<WiqlResponse>("wit/wiql?api-version=7.1", wiql);
    const ids = result.workItems.map((item) => item.id);

    if (ids.length === 0) {
      return [];
    }

    const details = await this.client.get<WorkItemsResponse>(`wit/workitems?ids=${ids.join(",")}&api-version=7.1`);
    return details.value.map((item) => ({
      id: item.id,
      title: String(item.fields["System.Title"] ?? ""),
      state: String(item.fields["System.State"] ?? ""),
      assignedTo: String(item.fields["System.AssignedTo"] ?? ""),
      workItemType: String(item.fields["System.WorkItemType"] ?? "")
    }));
  }
}
```

- [ ] **Step 3: Criar `sprint-service.ts`**

```ts
import { AzureDevOpsClient } from "./azure-devops-client.js";

export type SprintSummary = {
  id: string;
  name: string;
  path: string;
};

type IterationsResponse = {
  value: Array<{
    id: string;
    name: string;
    path: string;
    attributes?: { timeFrame?: string };
  }>;
};

export class SprintService {
  constructor(private readonly client: AzureDevOpsClient, private readonly team: string | null) {}

  async getCurrentSprint(): Promise<SprintSummary | null> {
    const teamSegment = this.team ? `${encodeURIComponent(this.team)}/` : "";
    const result = await this.client.getProjectRelative<IterationsResponse>(`${teamSegment}_apis/work/teamsettings/iterations?api-version=7.1`);
    const current = result.value.find((iteration) => iteration.attributes?.timeFrame === "current");

    if (!current) {
      return null;
    }

    return { id: current.id, name: current.name, path: current.path };
  }
}
```

- [ ] **Step 4: Rodar build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/azure-devops
git commit -m "feat: add azure devops discovery client"
```

---

### Task 9: Adapter Playwright do 7pace

**Files:**
- Criar: `src/sevenpace/selectors.ts`
- Criar: `src/sevenpace/sevenpace-playwright.ts`
- Criar: `src/sevenpace/time-entry-reader.ts`
- Criar: `src/sevenpace/time-entry-writer.ts`

- [ ] **Step 1: Criar seletores centralizados**

```ts
export const sevenPaceSelectors = {
  timeExplorerRoot: "[data-testid='time-explorer'], .time-explorer",
  addEntryButton: "button:has-text('Add'), button:has-text('New'), button:has-text('Adicionar')",
  workItemInput: "input[aria-label*='Work item'], input[placeholder*='work item'], input[placeholder*='item']",
  durationInput: "input[aria-label*='Duration'], input[placeholder*='Duration'], input[placeholder*='tempo']",
  descriptionInput: "textarea, input[aria-label*='Description'], input[placeholder*='Description']",
  saveButton: "button:has-text('Save'), button:has-text('Salvar')",
  entryRow: "[data-testid='time-entry-row'], .time-entry-row"
} as const;
```

- [ ] **Step 2: Criar browser/session**

```ts
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import type { HourLauncherConfig } from "../types/domain.js";

export class SevenPacePlaywright {
  constructor(private readonly config: HourLauncherConfig["sevenPace"]) {}

  async openContext(): Promise<BrowserContext> {
    return chromium.launchPersistentContext(".auth/sevenpace-profile", {
      headless: this.config.headless,
      viewport: { width: 1440, height: 1000 }
    });
  }

  async openTimesheet(date: string): Promise<{ context: BrowserContext; page: Page }> {
    const context = await this.openContext();
    const page = await context.newPage();
    await page.goto(`${this.config.baseUrl}/_apps/hub/7pace.Timetracker.TimetrackerHub`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.getByText(date, { exact: false }).first().catch(() => undefined);
    return { context, page };
  }
}
```

- [ ] **Step 3: Criar reader inicial**

```ts
import type { Page } from "@playwright/test";
import type { WorkItemId } from "../types/domain.js";
import { sevenPaceSelectors } from "./selectors.js";

export type ExistingTimeEntry = {
  id?: string;
  date: string;
  workItemId: WorkItemId;
  minutes: number;
  description: string;
};

export async function readEntriesForDate(page: Page, date: string): Promise<ExistingTimeEntry[]> {
  const rows = page.locator(sevenPaceSelectors.entryRow);
  const count = await rows.count();
  const entries: ExistingTimeEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    const text = await rows.nth(index).innerText();
    const workItemMatch = /#?(\d{5,})/.exec(text);
    if (!workItemMatch) {
      continue;
    }

    entries.push({
      date,
      workItemId: Number(workItemMatch[1]),
      minutes: 0,
      description: text
    });
  }

  return entries;
}
```

- [ ] **Step 4: Criar writer inicial**

```ts
import type { Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import { formatMinutes } from "../allocation/time-math.js";
import { sevenPaceSelectors } from "./selectors.js";

export async function createTimeEntry(page: Page, entry: PlannedEntry): Promise<void> {
  await page.locator(sevenPaceSelectors.addEntryButton).first().click();
  await page.locator(sevenPaceSelectors.workItemInput).first().fill(String(entry.workItemId));
  await page.keyboard.press("Enter");
  await page.locator(sevenPaceSelectors.durationInput).first().fill(formatMinutes(entry.minutes));
  await page.locator(sevenPaceSelectors.descriptionInput).first().fill(entry.description);
  await page.locator(sevenPaceSelectors.saveButton).first().click();
  await page.waitForLoadState("networkidle");
}
```

- [ ] **Step 5: Rodar build**

Run: `npm run build`

Expected: PASS. Os seletores podem precisar ajuste manual depois da primeira inspeção real do 7pace.

- [ ] **Step 6: Commit**

```bash
git add src/sevenpace
git commit -m "feat: add initial sevenpace playwright adapter"
```

---

### Task 10: Storage de Run Logs

**Files:**
- Criar: `src/storage/run-log-store.ts`

- [ ] **Step 1: Criar storage**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { PlannedEntry } from "../types/domain.js";

export type RunLog = {
  date: string;
  plannedHash: string;
  entries: PlannedEntry[];
  result: "planned" | "written" | "failed";
  finalTotalMinutes?: number;
  errorMessage?: string;
  createdAt: string;
};

export function hashEntries(entries: PlannedEntry[]): string {
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

export async function writeRunLog(log: Omit<RunLog, "plannedHash" | "createdAt">): Promise<string> {
  await mkdir(".runs", { recursive: true });
  const fullLog: RunLog = {
    ...log,
    plannedHash: hashEntries(log.entries),
    createdAt: new Date().toISOString()
  };
  const path = `.runs/${log.date}-${fullLog.plannedHash.slice(0, 8)}.json`;
  await writeFile(path, JSON.stringify(fullLog, null, 2), "utf8");
  return path;
}
```

- [ ] **Step 2: Rodar build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/storage/run-log-store.ts
git commit -m "feat: add local run log storage"
```

---

### Task 11: CLI `plan-day`

**Files:**
- Criar: `src/cli/index.ts`
- Criar: `src/cli/commands/plan-day.ts`

- [ ] **Step 1: Criar comando `plan-day.ts`**

```ts
import { Command } from "commander";
import { planDay } from "../../allocation/allocation-engine.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { renderReview } from "../../review/review-renderer.js";
import { AzureDevOpsClient } from "../../azure-devops/azure-devops-client.js";
import { WorkItemService } from "../../azure-devops/work-item-service.js";

export function buildPlanDayCommand(): Command {
  return new Command("plan-day")
    .requiredOption("--activities <path>", "Arquivo JSON com atividades do dia")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .action(async (options: { activities: string; config: string }) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      const workItems = await new WorkItemService(new AzureDevOpsClient(config.azureDevOps)).findActiveAssignedUserStories();
      const capexWorkItem = workItems[0];

      if (!capexWorkItem) {
        throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada.");
      }

      const plan = planDay({
        date: activityFile.date,
        activities: activityFile.activities,
        config,
        capexWorkItem
      });

      console.log(renderReview(plan.date, plan.entries));
    });
}
```

- [ ] **Step 2: Criar entrypoint `index.ts`**

```ts
import { Command } from "commander";
import { buildPlanDayCommand } from "./commands/plan-day.js";

const program = new Command();

program
  .name("hour-launcher")
  .description("Automacao de lancamento de horas no Azure DevOps + 7pace")
  .version("0.1.0");

program.addCommand(buildPlanDayCommand());

await program.parseAsync(process.argv);
```

- [ ] **Step 3: Rodar build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/cli
git commit -m "feat: add plan-day cli command"
```

---

### Task 12: CLI `auth-sevenpace`

**Files:**
- Criar: `src/cli/commands/auth-sevenpace.ts`
- Modificar: `src/cli/index.ts`

- [ ] **Step 1: Criar comando**

```ts
import { Command } from "commander";
import { loadConfig } from "../../config/config-loader.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";

export function buildAuthSevenPaceCommand(): Command {
  return new Command("auth-sevenpace")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .action(async (options: { config: string }) => {
      const config = await loadConfig(options.config);
      const sevenPace = new SevenPacePlaywright({ ...config.sevenPace, headless: false });
      const context = await sevenPace.openContext();
      const page = await context.newPage();
      await page.goto(`${config.sevenPace.baseUrl}/_apps/hub/7pace.Timetracker.TimetrackerHub`);
      console.log("Conclua o login no navegador aberto. Pressione Ctrl+C quando terminar.");
      await page.waitForTimeout(10 * 60 * 1000);
      await context.close();
    });
}
```

- [ ] **Step 2: Registrar comando no entrypoint**

Atualizar `src/cli/index.ts`:

```ts
import { Command } from "commander";
import { buildAuthSevenPaceCommand } from "./commands/auth-sevenpace.js";
import { buildPlanDayCommand } from "./commands/plan-day.js";

const program = new Command();

program
  .name("hour-launcher")
  .description("Automacao de lancamento de horas no Azure DevOps + 7pace")
  .version("0.1.0");

program.addCommand(buildPlanDayCommand());
program.addCommand(buildAuthSevenPaceCommand());

await program.parseAsync(process.argv);
```

- [ ] **Step 3: Rodar build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/auth-sevenpace.ts src/cli/index.ts
git commit -m "feat: add sevenpace auth command"
```

---

### Task 13: CLI `launch-day`

**Files:**
- Criar: `src/cli/commands/launch-day.ts`
- Modificar: `src/cli/index.ts`

- [ ] **Step 1: Criar comando**

```ts
import { Command } from "commander";
import { decideDuplicateAction } from "../../allocation/duplicate-policy.js";
import { planDay } from "../../allocation/allocation-engine.js";
import { sumMinutes } from "../../allocation/time-math.js";
import { AzureDevOpsClient } from "../../azure-devops/azure-devops-client.js";
import { WorkItemService } from "../../azure-devops/work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { confirmReview } from "../../review/confirmation.js";
import { renderReview } from "../../review/review-renderer.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";
import { readEntriesForDate } from "../../sevenpace/time-entry-reader.js";
import { createTimeEntry } from "../../sevenpace/time-entry-writer.js";
import { writeRunLog } from "../../storage/run-log-store.js";

export function buildLaunchDayCommand(): Command {
  return new Command("launch-day")
    .requiredOption("--activities <path>", "Arquivo JSON com atividades do dia")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .action(async (options: { activities: string; config: string }) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      const workItems = await new WorkItemService(new AzureDevOpsClient(config.azureDevOps)).findActiveAssignedUserStories();
      const capexWorkItem = workItems[0];

      if (!capexWorkItem) {
        throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada.");
      }

      const plan = planDay({ date: activityFile.date, activities: activityFile.activities, config, capexWorkItem });
      console.log(renderReview(plan.date, plan.entries));

      if (!(await confirmReview())) {
        await writeRunLog({ date: plan.date, entries: plan.entries, result: "failed", errorMessage: "Usuario cancelou a revisao." });
        console.log("Lancamento cancelado.");
        return;
      }

      const sevenPace = new SevenPacePlaywright(config.sevenPace);
      const { context, page } = await sevenPace.openTimesheet(plan.date);

      try {
        const existingEntries = await readEntriesForDate(page, plan.date);
        for (const entry of plan.entries) {
          const matchingEntries = existingEntries.filter((existing) => existing.workItemId === entry.workItemId);
          const action = decideDuplicateAction({
            existingCount: matchingEntries.length,
            configuredAction: config.duplicatePolicy.sameDateSameWorkItem
          });

          if (action === "fail") {
            throw new Error(`Entrada duplicada ambigua para work item ${entry.workItemId}.`);
          }

          if (action === "skip") {
            continue;
          }

          await createTimeEntry(page, entry);
        }

        const finalEntries = await readEntriesForDate(page, plan.date);
        const finalTotalMinutes = sumMinutes(finalEntries);

        if (config.duplicatePolicy.validateFinalTotal && finalTotalMinutes !== config.time.dailyTargetMinutes) {
          throw new Error(`Total final invalido no 7pace: ${finalTotalMinutes} minutos.`);
        }

        await writeRunLog({ date: plan.date, entries: plan.entries, result: "written", finalTotalMinutes });
      } catch (error) {
        await writeRunLog({
          date: plan.date,
          entries: plan.entries,
          result: "failed",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        await context.close();
      }
    });
}
```

- [ ] **Step 2: Registrar comando**

Atualizar `src/cli/index.ts`:

```ts
import { Command } from "commander";
import { buildAuthSevenPaceCommand } from "./commands/auth-sevenpace.js";
import { buildLaunchDayCommand } from "./commands/launch-day.js";
import { buildPlanDayCommand } from "./commands/plan-day.js";

const program = new Command();

program
  .name("hour-launcher")
  .description("Automacao de lancamento de horas no Azure DevOps + 7pace")
  .version("0.1.0");

program.addCommand(buildPlanDayCommand());
program.addCommand(buildLaunchDayCommand());
program.addCommand(buildAuthSevenPaceCommand());

await program.parseAsync(process.argv);
```

- [ ] **Step 3: Rodar build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/launch-day.ts src/cli/index.ts
git commit -m "feat: add launch-day cli command"
```

---

### Task 14: README e Verificação Final

**Files:**
- Criar: `README.md`

- [ ] **Step 1: Criar README**

```md
# Hour Launcher

Automacao local para planejar e lancar horas no Azure DevOps + 7pace TimeTracker.

## Fluxo do MVP

1. Copie `config/hour-launcher.example.json` para `config/hour-launcher.json`.
2. Ajuste `azureDevOps.project`.
3. Rode `az login` se usar `authMethod: "azure-cli"`.
4. Rode `npm run auth:sevenpace` para salvar a sessao visual do navegador.
5. Crie um arquivo de atividades baseado em `config/activities.example.json`.
6. Rode `npm run plan-day -- --activities config/activities.local.json`.
7. Rode `npm run launch-day -- --activities config/activities.local.json`.

## Seguranca

A automacao nao pede usuario e senha. O login visual acontece no navegador da Microsoft/Azure DevOps. Tokens PAT, quando usados como fallback, devem ficar apenas em variavel de ambiente.
```

- [ ] **Step 2: Rodar a suite completa de testes**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Rodar build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Verificar status Git**

Run: `git status --short`

Expected: somente `README.md` não commitado nesta task.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add mvp usage guide"
```

---

## Checklist de Cobertura da Spec

- Config JSON: Task 3.
- Entrada de atividades: Task 3.
- Engine de distribuição de 8 horas: Task 5.
- Daily automática: Task 5.
- Regras OPEX: Task 4.
- Modo revisão: Task 7, Task 11, Task 13.
- Azure DevOps REST API: Task 8.
- Playwright/7pace: Task 9, Task 12, Task 13.
- Estratégia sem coleta de usuário/senha: Task 9, Task 12, Task 14.
- Prevenção de duplicidade: Task 6, Task 13.
- Logs locais: Task 10, Task 13.
- Verificação final: Task 14.

## Riscos Conhecidos

- Os seletores reais do 7pace podem diferir dos seletores iniciais. A primeira execução visual deve ser usada para ajustar `src/sevenpace/selectors.ts`.
- A leitura de minutos no 7pace começa simplificada. A validação final pode exigir parsing específico da UI real.
- O endpoint de sprint atual pode depender do nome exato do time no projeto Azure DevOps.
- Azure CLI pode não estar logado ou não ter permissão; nesse caso o fallback PAT deve ser usado.
