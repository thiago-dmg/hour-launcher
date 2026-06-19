# Guia de uso para o time

Este projeto automatiza lancamentos no 7pace para o Azure DevOps. Ele abre o navegador apenas para usar a sessao autenticada do usuario e fazer as chamadas HTTP com permissao correta. O lancamento em si e feito pela API do 7pace.

## O que ele lanca

Para cada dia util que ainda nao tem 8h lancadas:

| Faixa | Horas | Work item | Activity Type |
| --- | ---: | --- | --- |
| 10:00 - 10:30 | 0h30 | Daily configurada em `defaults.dailyWorkItemId` | Rituais Scrum |
| 10:30 - 18:00 | 7h30 | Task CAPEX filha de uma US do usuario | Desenvolvimento |

Se o dia ja tiver horas parciais, ele completa somente o saldo ate 8h. Se o dia ja tiver 8h, ele pula.

## Como ele escolhe a US e a Task

1. Busca no Azure DevOps as User Stories atribuidas ao usuario logado (`AssignedTo = @Me`).
2. Ignora US nos estados `Removed` e `Closed`.
3. Busca as Tasks filhas dessas US.
4. Ordena as Tasks por data de criacao.
5. Usa a primeira Task ainda nao usada no periodo.
6. Nao reutiliza a mesma Task em outro dia. Se nao houver Task livre, o comando falha em vez de repetir silenciosamente.
7. Ignora qualquer US listada em `defaults.excludedUserStoryIds` ou passada por `--exclude-user-story-id`.

Isso responde a pergunta principal: ele nao lanca na US pai quando existem Tasks filhas elegiveis; ele lanca na Task do dia.

## Ignorar uma US especifica

Use isso quando uma US esta aberta/em desenvolvimento, mas nao deve receber horas por algum motivo externo, como dependencia de infra ou decisao do time.

Pelo comando:

```bash
npm run launch -- --activities config/activities.local.json --exclude-user-story-id 170029 --yes
```

Pode passar mais de uma:

```bash
npm run launch -- --activities config/activities.local.json --exclude-user-story-id 170029 --exclude-user-story-id 173262 --yes
```

Ou por virgula:

```bash
npm run launch -- --activities config/activities.local.json --exclude-user-story-id 170029,173262 --yes
```

Para deixar fixo no config:

```json
{
  "defaults": {
    "dailyWorkItemId": 171055,
    "capexStrategy": "activeAssignedUserStory",
    "capexWorkItemId": null,
    "excludedUserStoryIds": [170029]
  }
}
```

Quando uma US e ignorada, todas as Tasks filhas dela tambem ficam fora da selecao.

## Instalacao

```bash
npm install
npm run init-config
npm run install:browsers
```

O comando `init-config` cria:

- `config/hour-launcher.json`
- `config/activities.local.json`

## Configuracao

Em `config/hour-launcher.json`, revise principalmente:

```json
{
  "sevenPace": {
    "baseUrl": "https://dotzmkt.visualstudio.com/Tribos%20Dotz",
    "timesheetUrl": "https://dotzmkt.visualstudio.com/Tribos%20Dotz/_apps/hub/7pace.Timetracker.Monthly",
    "headless": false
  },
  "defaults": {
    "dailyWorkItemId": 171055
  }
}
```

Em `config/activities.local.json`, a `date` define de onde o preenchimento deve comecar:

```json
{
  "date": "2026-05-25",
  "activities": []
}
```

Com `activities: []`, o dia padrao fica com Daily + CAPEX. Atividades OPEX especificas podem ser adicionadas depois, mas o fluxo atual do time e Daily + Task CAPEX.

## Lancar horas

```bash
npm run launch -- --activities config/activities.local.json --yes
```

O comando percorre todos os dias uteis desde a data do arquivo ate hoje.

Exemplo de comportamento:

- Se 2026-05-25 ja tem 8h, pula.
- Se 2026-05-26 esta vazio, cria Daily 0h30 + Task CAPEX 7h30.
- Se 2026-05-27 tem 4h lancadas, completa so as 4h faltantes.

## Agendamento automatico diario

Para nao precisar rodar manualmente todo dia:

```bash
npm run setup-scheduler
```

Por padrao, isso agenda o lancamento de segunda a sexta as 18:10.

O mesmo comando funciona nos principais sistemas:

| Sistema | Como agenda |
| --- | --- |
| Windows | Agendador de Tarefas |
| Linux | `crontab` |
| macOS | `crontab` |

Para escolher outro horario:

```bash
npm run setup-scheduler -- --time 18:30
```

Para remover o agendamento:

```bash
npm run remove-scheduler
```

Observacao: o comando ainda depende da sessao autenticada do usuario. Se o 7pace/Azure DevOps pedir login novamente, abra o projeto, rode `npm run launch -- --activities config/activities.local.json --yes`, autentique no navegador e depois o agendamento volta a funcionar.

## Reparar lancamentos antigos

Use quando existirem lancamentos CAPEX antigos na US pai ou quando uma Task foi repetida em mais de um dia.

```bash
npm run repair -- --activities config/activities.local.json --yes
```

O reparo:

- nao mexe na Daily;
- nao altera duracao nem horario;
- altera apenas o Work Item do worklog CAPEX;
- troca US pai por Task filha;
- troca Task repetida por outra Task livre;
- falha antes de alterar se nao houver Tasks suficientes para evitar repeticao.

## Validacao antes de compartilhar mudancas

```bash
npm test
npm run build
```

## Perguntas comuns

### Precisa instalar Azure CLI?

Nao para o fluxo atual de lancamento. A descoberta usa a sessao do navegador no Azure DevOps.

### O navegador ainda abre?

Sim. Ele abre para autenticar e manter a sessao do Azure DevOps/7pace. A diferenca e que o sistema nao fica clicando em campos da tela para lancar horas.

### Ele pega tarefas de outras pessoas?

A busca parte das US atribuidas ao usuario logado. Se as Tasks filhas nao tiverem responsavel individual, elas ainda sao consideradas porque pertencem a uma US do usuario.

### O que acontece se faltarem Tasks?

O comando falha e avisa que nao ha Tasks CAPEX livres suficientes. Ele nao repete Task escondido.

### Posso revisar depois?

Sim. Depois do comando, abra o 7pace Monthly e confira os dias lancados.
