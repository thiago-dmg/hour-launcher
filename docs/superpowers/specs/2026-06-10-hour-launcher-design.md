# Design do Hour Launcher

## Objetivo

Criar uma automação em TypeScript para planejar e lançar horas diárias no Azure DevOps + 7pace TimeTracker, reduzindo o lançamento manual sem remover a etapa obrigatória de revisão humana antes de salvar.

O MVP deve processar um dia por vez, incluir automaticamente o tempo de Daily, distribuir o restante entre itens CAPEX/OPEX, evitar lançamentos duplicados e validar que o total final do dia seja exatamente 8 horas.

## Contexto Atual

O repositório começa vazio, exceto pelos metadados do Git. O primeiro entregável será uma nova aplicação CLI em TypeScript.

O usuário trabalha 8 horas por dia. Um dia normal é:

- 0h30 de Daily.
- 7h30 na User Story principal ativa no board do Azure DevOps.

Alguns dias incluem reuniões, war rooms, refinamentos, sustentação, chamados GLPI, DLQs, treinamentos, feedbacks ou reuniões corporativas. Essas atividades reduzem o tempo restante de CAPEX. O sistema deve calcular o restante e manter o total em exatamente 8 horas.

## Arquitetura Recomendada

Usar uma arquitetura híbrida:

- Azure DevOps REST API para descoberta determinística de organização, projeto, iterações, work items, User Stories atribuídas e itens ativos do board.
- Playwright para interações com o 7pace TimeTracker, porque ainda não foi confirmado se existe API do 7pace disponível no ambiente.
- Um core de domínio em TypeScript para planejamento, mapeamento, política de duplicidade, validação e renderização da revisão.
- Suporte ao MCP do Azure DevOps como provider opcional futuro, não como dependência do MVP.

Essa abordagem mantém a automação previsível, testável e executável por script, limitando a automação de navegador ao ponto onde ela provavelmente é necessária: o lançamento de horas no 7pace.

## Alternativas Consideradas

### Apenas Playwright

É possível, mas frágil demais. Exigiria navegação por navegador tanto para descobrir dados no Azure DevOps quanto para lançar no 7pace. Qualquer mudança de UI em um dos sistemas poderia quebrar descoberta, seleção ou escrita.

### Azure DevOps API + Playwright

É a recomendação para o MVP. A REST API do Azure DevOps trata dados estruturados de forma confiável. O Playwright cuida da criação e atualização dos lançamentos no 7pace. Essa opção oferece o melhor equilíbrio entre confiabilidade, esforço de implementação e uso local.

### Azure DevOps MCP + Playwright

É útil para fluxos assistidos por agente/IA, mas menos ideal como dependência interna de runtime para uma automação repetível. O MCP pode ser adicionado depois como provider ou interface para uso assistido.

### Azure DevOps API + MCP + Playwright

É uma boa arquitetura final. O MVP deve começar com chamadas diretas à API e adicionar MCP somente depois que o fluxo principal estiver estável.

## Fluxo Geral

1. O usuário roda a CLI para uma data alvo.
2. A CLI carrega a configuração JSON.
3. O cliente Azure DevOps autentica e encontra:
   - usuário autenticado;
   - sprint atual;
   - User Stories ativas atribuídas ao usuário;
   - User Story CAPEX candidata a partir do board.
4. A lista de atividades do dia é carregada de um JSON ou de argumentos da CLI.
5. A engine de alocação adiciona o lançamento padrão de Daily.
6. O mapper OPEX converte atividades explícitas para work items ou Features OPEX configuradas.
7. A engine de alocação atribui os minutos restantes aos itens CAPEX.
8. O renderizador de revisão imprime os lançamentos propostos e o total.
9. O usuário confirma ou cancela.
10. O adapter do 7pace lê os lançamentos existentes na data.
11. A política de duplicidade decide se deve atualizar, ignorar ou falhar quando encontrar lançamentos existentes.
12. O adapter do 7pace escreve os lançamentos com Playwright.
13. O adapter lê novamente o dia e valida que o total é 8 horas.
14. O log local registra o plano, o resultado e o status da validação.

## Escopo do MVP

O MVP inclui:

- CLI em TypeScript.
- Arquivo de configuração JSON.
- Arquivo JSON para atividades do dia.
- Planejamento de um único dia por execução.
- Cliente Azure DevOps REST API usando autenticação local via Azure CLI/Azure Identity quando possível, com PAT apenas como fallback.
- Descoberta de User Stories ativas atribuídas ao usuário.
- Engine de alocação garantindo que o total planejado seja igual à meta diária configurada.
- Mapeamento OPEX para work item IDs fixos.
- Modo revisão no terminal.
- Sessão Playwright para o 7pace.
- Detecção de lançamento existente pela combinação de data + work item.
- Tratamento de duplicidade por atualização ou falha, conforme configuração.
- Validação final de que o total do dia é exatamente 8 horas.

O MVP não inclui:

- Criação automática de User Stories OPEX dentro de Features.
- Lançamento de múltiplos dias ou lote semanal.
- Integração com calendário.
- Integração direta com API do 7pace.
- Implementação de provider MCP.
- Heurísticas avançadas de priorização.
- Compensação semanal ou mensal.

## Regras de Domínio

A meta diária padrão é 480 minutos.

Daily tem padrão de 30 minutos e mapeia para o work item 171055.

Tudo que não estiver explicitamente listado como OPEX é CAPEX e deve ser lançado contra a User Story ativa do board.

Mapeamentos OPEX:

| Atividade | Destino |
| --- | --- |
| Sustentação | Feature 171057, criar User Story futuramente |
| Tarefa | Feature 171058, criar User Story futuramente |
| Refactor / Manutenção | Feature 171466, criar User Story futuramente |
| Treinamento / Feedback / Reunião corporativa | US 171056 |
| Refinamento / Planejamento / Daily | US 171055 |
| Reuniões | US 171054 |
| DLQs | US 171802 |
| Chamados GLPI | US 171804 |

No MVP, mapeamentos que exigem criação de User Story dentro de uma Feature devem falhar com uma mensagem clara, exceto quando o usuário informar um work item concreto na atividade de entrada. A criação automática fica planejada para uma versão posterior.

## Modelo de Configuração

O arquivo principal de configuração ficará em `config/hour-launcher.json`. Um arquivo versionado `config/hour-launcher.example.json` documentará o formato esperado.

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
    "sustentacao": {
      "label": "Sustentação",
      "featureId": 171057,
      "createUserStory": true
    },
    "tarefa": {
      "label": "Tarefa",
      "featureId": 171058,
      "createUserStory": true
    },
    "refactorManutencao": {
      "label": "Refactor / Manutenção",
      "featureId": 171466,
      "createUserStory": true
    },
    "treinamentoFeedbackReuniaoCorporativa": {
      "label": "Treinamento / Feedback / Reunião corporativa",
      "workItemId": 171056
    },
    "refinamentoPlanejamentoDaily": {
      "label": "Refinamento / Planejamento / Daily",
      "workItemId": 171055
    },
    "reunioes": {
      "label": "Reuniões",
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

## Modelo de Entrada de Atividades

Daily não precisa ser informada manualmente. Ela é adicionada por padrão, a menos que uma versão futura adicione uma opção para desativá-la.

Exemplo de arquivo de atividades:

```json
{
  "date": "2026-06-10",
  "activities": [
    {
      "type": "warRoom",
      "minutes": 60,
      "description": "War room produção",
      "workItemId": 171054
    },
    {
      "type": "reunioes",
      "minutes": 30,
      "description": "Alinhamento técnico"
    }
  ]
}
```

O campo `workItemId` é opcional quando o tipo da atividade mapeia diretamente para uma User Story OPEX. Ele é obrigatório no MVP para tipos OPEX que mapeiam apenas para Feature e exigem criação futura de User Story.

## Estratégia de Autenticação

A automação não deve pedir usuário e senha do Azure DevOps ou do 7pace.

Para a parte visual, o Playwright deve reaproveitar uma sessão já autenticada do navegador. Na prática, o usuário faz login uma vez no Azure DevOps/7pace em uma janela controlada pelo Playwright, e a automação salva localmente o estado dessa sessão em `.auth/`. Nas próximas execuções, a automação abre o Azure DevOps já logado, desde que a sessão ainda esteja válida.

O comando inicial de autenticação apenas abre o navegador para o usuário validar a sessão existente ou fazer login manualmente se necessário:

```bash
npm run auth:sevenpace
```

Esse comando não coleta senha. Ele só permite que o login aconteça no fluxo normal da Microsoft/Azure DevOps e grava o storage state local depois que o usuário estiver autenticado.

Para chamadas diretas à Azure DevOps REST API, o MVP terá duas possibilidades:

- reutilizar autenticação local via Azure CLI/Azure Identity quando isso estiver disponível na máquina;
- usar PAT via variável de ambiente `AZURE_DEVOPS_PAT` como fallback mais previsível para automação local.

O arquivo de configuração não deve conter segredos. Estado de autenticação gerado, logs de execução e configurações locais com segredos devem ficar no `.gitignore`.

Opções futuras de autenticação:

- priorizar Azure CLI auth para Azure DevOps.
- priorizar Azure Identity auth para Azure DevOps.
- MCP Azure DevOps auth por servidor MCP configurado.

## Prevenção de Duplicidade

Antes de escrever lançamentos, o adapter do 7pace deve ler os lançamentos existentes na data alvo.

Entradas são comparadas por:

- data;
- work item ID;
- opcionalmente descrição, quando múltiplas entradas para o mesmo work item forem permitidas.

Padrão do MVP:

- se existir uma entrada na mesma data e no mesmo work item, atualizá-la;
- se múltiplas entradas existentes tornarem a atualização ambígua, falhar e exibir essas entradas;
- depois de escrever, ler novamente o dia e validar o total final.

Um log local armazenará:

- data alvo;
- lançamentos planejados;
- hash do plano;
- resultado da operação;
- total final validado.

O log local é apoio de auditoria, não fonte da verdade. O 7pace continua sendo a fonte da verdade para detecção de duplicidade.

## Tratamento de Erros

A CLI deve falhar antes de escrever se:

- a configuração for inválida;
- a data alvo for inválida;
- a meta diária não puder ser atingida exatamente;
- as atividades explícitas excederem a meta diária;
- nenhuma User Story CAPEX ativa for encontrada;
- uma atividade OPEX exigir criação de User Story e nenhum work item concreto for informado;
- lançamentos existentes forem ambíguos;
- o usuário cancelar a revisão.

A CLI deve falhar depois de escrever se:

- o Playwright não conseguir confirmar o salvamento;
- a leitura final do 7pace não for igual à meta diária configurada.

Em falhas de validação pós-escrita, a CLI deve imprimir contexto suficiente para correção manual.

## Modo Revisão

A revisão é obrigatória no MVP.

Exemplo:

```text
Data: 10/06/2026

Daily: 0h30 -> US 171055
War Room: 1h00 -> US 171054
Reunião: 0h30 -> US 171054
US 172980: 6h00 -> CAPEX

Total: 8h00

Confirmar? (Sim/Não)
```

A CLI só lança as entradas após confirmação explícita.

## Estrutura de Pastas

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

## Estratégia de Testes

Testes unitários:

- formatação e parsing de tempo;
- mapeamento de regras OPEX;
- alocação com sucesso;
- falha de alocação quando atividades excedem a meta;
- falha de alocação quando não existe alvo CAPEX;
- decisões da política de duplicidade.

Testes em estilo integração:

- carregamento e validação da configuração;
- respostas mockadas do cliente Azure DevOps;
- testes do adapter Playwright após confirmação dos seletores reais da UI do 7pace.

Verificação manual:

- autenticar no 7pace em navegador visível;
- rodar `plan-day` e inspecionar a saída;
- rodar `launch-day` contra uma data segura ou work item de teste;
- confirmar que a leitura final totaliza 8 horas.

## Evolução Futura

Depois que o MVP estiver confiável:

1. Adicionar criação automática de User Stories sob Features OPEX.
2. Adicionar modo de lote para múltiplos dias ou semana.
3. Adicionar autenticação via Azure CLI ou Azure Identity.
4. Adicionar provider opcional para MCP Azure DevOps.
5. Investigar suporte à API do 7pace e substituir escritas via Playwright quando for seguro.
6. Adicionar importação de calendário para reuniões.
7. Adicionar distribuição CAPEX mais inteligente entre múltiplas User Stories ativas.

## Premissas Abertas

- A organização Azure DevOps é `https://dev.azure.com/dotzmkt`.
- O nome do projeto será informado na configuração local.
- A automação visual reaproveitará uma sessão já autenticada no navegador, sem pedir usuário e senha.
- Para chamadas REST API, Azure CLI/Azure Identity serão priorizados; PAT será mantido apenas como fallback local.
- O 7pace pode ser operado pela UI web do Azure DevOps com Playwright.
- Daily deve ser sempre adicionada, a menos que uma opção futura permita desativá-la.
- O MVP deve processar um dia por vez.
