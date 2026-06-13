# Hour Launcher

Automacao local para lancar horas no 7pace usando a sessao autenticada do Azure DevOps no navegador.

O fluxo atual nao preenche campos na tela. O Chromium e usado para autenticar e carregar o 7pace; os lancamentos sao feitos pela API REST interna do 7pace.

## Comandos principais

```bash
npm run launch -- --activities config/activities.local.json --yes
npm run repair -- --activities config/activities.local.json --yes
```

- `launch`: lanca dias uteis faltantes da data inicial do arquivo de atividades ate hoje.
- `repair`: repara lancamentos CAPEX antigos que ficaram na US pai ou em Tasks repetidas.

## Setup rapido

```bash
npm install
npm run init-config
npm run install:browsers
npm test
npm run build
```

Depois ajuste `config/hour-launcher.json` e `config/activities.local.json`.

No primeiro uso, o navegador pode pedir login/autorizacao do Azure DevOps/7pace. Faca o login na janela aberta e rode o comando novamente.

## Regra de lancamento

Para cada dia util faltante:

- Daily: 30 minutos na US configurada em `defaults.dailyWorkItemId`, das 10:00 as 10:30.
- CAPEX: 7h30 em uma Task filha de uma US atribuida ao usuario, das 10:30 as 18:00.
- Dias que ja possuem 8h sao ignorados.
- A mesma Task CAPEX nao e reutilizada em outro dia dentro do periodo processado.

Detalhes para o time: [docs/USO-TIME.md](docs/USO-TIME.md).
