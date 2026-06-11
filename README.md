# Hour Launcher

Automacao local para planejar e lancar horas no Azure DevOps + 7pace TimeTracker.

## Requisitos

- Node.js 18 ou superior.
- Acesso ao Azure DevOps da organizacao.
- Azure CLI logado quando `authMethod` for `azure-cli`.
- Sessao autenticada no Azure DevOps/7pace pelo navegador controlado pelo Playwright.

## Fluxo do MVP

1. Copie `config/hour-launcher.example.json` para `config/hour-launcher.json`.
2. Ajuste `azureDevOps.project`.
3. Rode `az login` se usar `authMethod: "azure-cli"`.
4. Rode `npm run install:browsers` para baixar o Chromium usado pelo Playwright.
5. Rode `npm run auth:sevenpace` para salvar a sessao visual do navegador. Esse comando nao lanca horas; ele apenas abre o 7pace para login/autorizacao.
6. Crie um arquivo de atividades baseado em `config/activities.example.json`. Deixe `activities: []` para um dia normal com apenas Daily + US principal.
7. Rode `npm run plan-day -- --activities config/activities.local.json`.
8. Rode `npm run launch-day -- --activities config/activities.local.json`.

## Seguranca

A automacao nao pede usuario e senha. O login visual acontece no navegador da Microsoft/Azure DevOps. Tokens PAT, quando usados como fallback, devem ficar apenas em variavel de ambiente.

## Comandos

```bash
npm install
npm run init-config
npm run install:browsers
npm test
npm run build
npm run auth:sevenpace
npm run plan-day -- --activities config/activities.local.json
npm run launch-day -- --activities config/activities.local.json --yes
```

Se o Azure CLI nao estiver instalado, informe a US principal manualmente:

```bash
npm run plan-day -- --activities config/activities.local.json --capex-work-item-id 172980
npm run launch-day -- --activities config/activities.local.json --capex-work-item-id 172980 --yes
```

Ou deixe uma US padrao em `config/hour-launcher.json`:

```json
"defaults": {
  "dailyWorkItemId": 171055,
  "capexStrategy": "activeAssignedUserStory",
  "capexWorkItemId": 172980
}
```

## Observacoes do MVP

- O lancamento processa um dia por vez.
- Daily e adicionada automaticamente conforme `time.defaultDailyMinutes`.
- Reunioes e outras atividades esporadicas so sao lancadas quando estiverem no arquivo de atividades.
- Tudo que nao estiver nas regras OPEX cai como CAPEX na User Story ativa atribuida ao usuario.
- Os seletores do 7pace podem precisar de ajuste apos a primeira execucao visual na UI real.
