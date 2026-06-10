# Hour Launcher Design

## Goal

Build a TypeScript automation that plans and launches daily work hours in Azure DevOps + 7pace TimeTracker, reducing manual entry while keeping a required human review step before saving.

The MVP must support one work day at a time, automatically include Daily time, distribute the remaining time across CAPEX/OPEX work items, avoid duplicate entries, and validate that the final daily total is exactly 8 hours.

## Current Context

The repository starts empty except for Git metadata. The first deliverable is a new TypeScript CLI application.

The user works 8 hours per day. A normal day is:

- 0h30 Daily.
- 7h30 on the main active User Story from the Azure DevOps board.

Some days include meetings, war rooms, refinements, support work, GLPI tickets, DLQs, training, feedback, or corporate meetings. Those activities reduce the remaining CAPEX time. The system must calculate the remainder and keep the total at exactly 8 hours.

## Recommended Architecture

Use a hybrid architecture:

- Azure DevOps REST API for deterministic discovery of organization data, project data, iterations, work items, assigned User Stories, and active board items.
- Playwright for 7pace TimeTracker interactions, because 7pace availability through API is not confirmed.
- A TypeScript domain core for planning, mapping, duplicate policy, validation, and review rendering.
- MCP Azure DevOps support as a later optional provider, not as an MVP dependency.

This keeps the automation scriptable and testable while limiting browser automation to the place where it is most likely required: 7pace time entry.

## Alternatives Considered

### Playwright Only

This is possible but too fragile. It would require browser navigation for both Azure DevOps discovery and 7pace entry. Any UI change in either system could break discovery, selection, or entry writing.

### Azure DevOps API + Playwright

This is the recommended MVP. Azure DevOps REST API handles structured data reliably. Playwright handles 7pace entry creation and update. This gives the best balance of reliability, implementation effort, and local usability.

### Azure DevOps MCP + Playwright

This is useful for agent-assisted workflows but less ideal as the internal runtime dependency for a repeatable automation. MCP can be added later as a provider or assistant-facing interface.

### Azure DevOps API + MCP + Playwright

This is a good final-state architecture. The MVP should start with direct API calls and add MCP only after the core workflow is stable.

## High-Level Flow

1. User runs the CLI for a target date.
2. CLI loads JSON configuration.
3. Azure DevOps client authenticates and finds:
   - authenticated user;
   - current sprint;
   - active User Stories assigned to the user;
   - candidate CAPEX User Story from the board.
4. Input activity list is loaded from JSON or CLI arguments.
5. Allocation engine adds the default Daily entry.
6. OPEX mapper maps explicit activities to configured OPEX work items or Features.
7. Allocation engine assigns the remaining minutes to CAPEX work items.
8. Review renderer prints the proposed entries and total.
9. User confirms or cancels.
10. 7pace adapter reads existing entries for the date.
11. Duplicate policy decides whether to update, skip, or fail on existing entries.
12. 7pace adapter writes entries with Playwright.
13. Adapter reads the day again and validates the total equals 8 hours.
14. Local run log records the plan, result, and validation status.

## MVP Scope

The MVP will include:

- TypeScript CLI.
- JSON config file.
- JSON activity input file.
- Daily single-date planning.
- Azure DevOps REST API client using PAT authentication.
- Discovery of assigned active User Stories.
- Allocation engine that guarantees the planned total equals the configured daily target.
- OPEX mapping for fixed work item IDs.
- Terminal review mode.
- Playwright browser session for 7pace.
- Existing-entry detection for same date and work item.
- Update or fail duplicate handling based on config.
- Final validation that the day total is exactly 8 hours.

The MVP will not include:

- Automatic creation of OPEX User Stories under Features.
- Multiple-day or weekly batch entry.
- Calendar integration.
- 7pace direct API integration.
- MCP provider implementation.
- Advanced priority heuristics.
- Weekly or monthly compensation.

## Domain Rules

The daily target defaults to 480 minutes.

Daily defaults to 30 minutes and maps to work item 171055.

Anything not explicitly listed as OPEX is CAPEX and should be launched against the active board User Story.

OPEX mappings:

| Activity | Target |
| --- | --- |
| Sustentacao | Feature 171057, create User Story later |
| Tarefa | Feature 171058, create User Story later |
| Refactor / Manutencao | Feature 171466, create User Story later |
| Treinamento / Feedback / Reuniao corporativa | US 171056 |
| Refinamento / Planejamento / Daily | US 171055 |
| Reunioes | US 171054 |
| DLQs | US 171802 |
| Chamados GLPI | US 171804 |

For MVP, mappings that require creating a User Story under a Feature should be rejected with a clear message unless the user provides a concrete work item override in the activity input. Automatic creation is planned for a later release.

## Configuration Model

The main config file will live at `config/hour-launcher.json`. A checked-in `config/hour-launcher.example.json` will document the expected shape.

```json
{
  "azureDevOps": {
    "orgUrl": "https://dev.azure.com/dotzmkt",
    "project": "NOME_DO_PROJETO",
    "authMethod": "pat",
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
    "sustentacao": {
      "label": "Sustentacao",
      "featureId": 171057,
      "createUserStory": true
    },
    "tarefa": {
      "label": "Tarefa",
      "featureId": 171058,
      "createUserStory": true
    },
    "refactorManutencao": {
      "label": "Refactor / Manutencao",
      "featureId": 171466,
      "createUserStory": true
    },
    "treinamentoFeedbackReuniaoCorporativa": {
      "label": "Treinamento / Feedback / Reuniao corporativa",
      "workItemId": 171056
    },
    "refinamentoPlanejamentoDaily": {
      "label": "Refinamento / Planejamento / Daily",
      "workItemId": 171055
    },
    "reunioes": {
      "label": "Reunioes",
      "workItemId": 171054
    },
    "dlqs": {
      "label": "DLQs",
      "workItemId": 171802
    },
    "glpi": {
      "label": "Chamados GLPI",
      "workItemId": 171804
    }
  },
  "duplicatePolicy": {
    "sameDateSameWorkItem": "update",
    "allowMultipleEntriesSameWorkItem": false,
    "validateFinalTotal": true
  }
}
```

## Activity Input Model

Daily does not need to be entered manually. It is added by default unless disabled in a later version.

Example activity file:

```json
{
  "date": "2026-06-10",
  "activities": [
    {
      "type": "warRoom",
      "minutes": 60,
      "description": "War room producao",
      "workItemId": 171054
    },
    {
      "type": "reunioes",
      "minutes": 30,
      "description": "Alinhamento tecnico"
    }
  ]
}
```

The `workItemId` field is optional when the activity type maps directly to an OPEX User Story. It is required in MVP for OPEX types that map only to a Feature and require future User Story creation.

## Authentication Strategy

Azure DevOps REST API will use a Personal Access Token in the MVP. The token is read from `AZURE_DEVOPS_PAT`.

The config file must not contain secrets.

Playwright authentication for 7pace will use a persistent local browser profile or storage state under `.auth/`. The user will run an explicit authentication command first:

```bash
npm run auth:sevenpace
```

Generated auth state, run logs, and local config with secrets must be gitignored.

Future authentication options:

- Azure CLI auth for Azure DevOps.
- Azure Identity auth for Azure DevOps.
- MCP Azure DevOps auth through configured MCP server.

## Duplicate Prevention

Before writing entries, the 7pace adapter must read existing entries for the target date.

Entries are compared by:

- date;
- work item ID;
- optionally description when multiple entries for the same work item are allowed.

MVP default:

- if an entry exists for the same date and work item, update it;
- if multiple existing entries make the update ambiguous, fail and show the existing entries;
- after writing, read the day again and validate the final total.

A local run log will store:

- target date;
- planned entries;
- hash of the plan;
- operation result;
- final validated total.

The local run log is an audit aid, not the source of truth. 7pace remains the source of truth for duplicate detection.

## Error Handling

The CLI should fail before writing if:

- config is invalid;
- target date is invalid;
- daily target cannot be reached exactly;
- explicit activities exceed the daily target;
- no active CAPEX User Story can be found;
- OPEX activity requires User Story creation but no concrete work item ID was provided;
- duplicate existing entries are ambiguous;
- user cancels review.

The CLI should fail after writing if:

- Playwright cannot confirm save;
- final 7pace readback does not equal the configured daily target.

In post-write validation failures, the CLI must print enough context for manual correction.

## Review Mode

Review is mandatory in MVP.

Example:

```text
Data: 10/06/2026

Daily: 0h30 -> US 171055
War Room: 1h00 -> US 171054
Reuniao: 0h30 -> US 171054
US 172980: 6h00 -> CAPEX

Total: 8h00

Confirmar? (Sim/Nao)
```

The CLI only launches entries after explicit confirmation.

## Folder Structure

```text
hour-launcher/
  config/
    hour-launcher.example.json
    activities.example.json

  docs/
    superpowers/
      specs/
        2026-06-10-hour-launcher-design.md

  src/
    cli/
      index.ts
      commands/
        plan-day.ts
        launch-day.ts

    config/
      config-loader.ts
      schema.ts

    azure-devops/
      azure-devops-client.ts
      work-item-service.ts
      sprint-service.ts

    allocation/
      allocation-engine.ts
      opex-mapper.ts
      time-math.ts
      duplicate-policy.ts

    sevenpace/
      sevenpace-playwright.ts
      selectors.ts
      time-entry-reader.ts
      time-entry-writer.ts

    review/
      review-renderer.ts
      confirmation.ts

    storage/
      run-log-store.ts

    types/
      domain.ts

  tests/
    allocation/
      allocation-engine.test.ts
      opex-mapper.test.ts
      time-math.test.ts

  playwright.config.ts
  package.json
  tsconfig.json
  README.md
```

## Testing Strategy

Unit tests:

- time math formatting and parsing;
- OPEX rule mapping;
- allocation success;
- allocation failure when activities exceed target;
- allocation failure when no CAPEX target exists;
- duplicate policy decisions.

Integration-style tests:

- config loading and validation;
- mocked Azure DevOps client responses;
- Playwright adapter tests can be added after selectors are confirmed against the real 7pace UI.

Manual verification:

- authenticate 7pace in a visible browser;
- run `plan-day` and inspect output;
- run `launch-day` against a safe date or test work item;
- confirm readback total equals 8 hours.

## Future Evolution

After the MVP works reliably:

1. Add automatic User Story creation under OPEX Features.
2. Add multi-day and weekly batch mode.
3. Add Azure CLI or Azure Identity auth.
4. Add optional MCP Azure DevOps provider.
5. Investigate 7pace API support and replace Playwright writes when safe.
6. Add calendar import for meetings.
7. Add smarter CAPEX distribution across multiple active User Stories.

## Open Assumptions

- The Azure DevOps organization is `https://dev.azure.com/dotzmkt`.
- Project name will be provided in local config.
- PAT authentication is acceptable for the first implementation.
- 7pace can be operated through the Azure DevOps web UI with Playwright.
- Daily should always be added unless a later config option disables it.
- The MVP should process one day at a time.
