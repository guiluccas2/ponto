# ⏱️ Ponto & Horas

Aplicativo web (PWA) para **anotar e controlar horas trabalhadas e horas extras**, usado ao mesmo tempo no **celular e no computador**, com **salvamento automático no GitHub**.

## Funcionalidades
- Botão de **registrar ponto** (entrada/saída, quantos intervalos quiser; turnos que passam da meia-noite).
- **Anotações por dia**, salvas automaticamente.
- Cálculo de **horas trabalhadas, previstas, saldo diário, extras e horas faltantes**.
- Horas extras separadas por adicional: **dias úteis (50%)** e **domingos/feriados (100%)** — percentuais configuráveis; sábado opcionalmente a 100%.
- **Banco de horas** acumulado (com saldo inicial), **tolerância CLT** (10 min/dia, configurável).
- **Feriados nacionais** reconhecidos automaticamente (inclui Sexta-feira Santa e Consciência Negra).
- Tipos de dia: normal, feriado, folga/DSR, compensação, atestado/abono, férias, falta.
- **Saída prevista** em tempo real e **valor estimado das extras** (informando o valor da hora).
- Exportação **CSV** (abre no Excel) e impressão/PDF do mês; backup/restauração em JSON.
- Funciona **offline** e pode ser instalado na tela inicial.

## Como funciona a sincronização
Os dados ficam num arquivo `dados/horas.json` dentro de um repositório **privado** seu no GitHub.
Cada alteração é salva localmente na hora e enviada ao GitHub ~1,5 s depois (cada envio vira um commit = histórico completo).
Os aparelhos buscam atualizações a cada 30 s e sempre que o app volta a ficar visível. Se dois aparelhos editarem ao mesmo tempo, os dados são **mesclados por dia** (vale a edição mais recente de cada dia) — nada se perde.

## Publicação (uma única vez)
1. **Repositório do app** (público): crie, por exemplo, `ponto`, envie estes arquivos e ative
   *Settings → Pages → Source: Deploy from a branch → `main` / root*.
   O app ficará em `https://SEU-USUARIO.github.io/ponto/`.
2. **Repositório de dados** (privado): crie `ponto-dados` marcando “Add a README”.
3. **Token**: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*,
   acesso apenas ao `ponto-dados`, permissão **Contents: Read and write**.
4. Abra o app no computador e no celular → **Ajustes** → preencha usuário, `ponto-dados` e o token → **Salvar e conectar**.
5. No celular: menu do navegador → **Adicionar à tela inicial** (Android/Chrome) ou **Compartilhar → Adicionar à Tela de Início** (iPhone/Safari).

> O token fica guardado só no navegador de cada aparelho. Os dados nunca ficam no repositório público do app.
