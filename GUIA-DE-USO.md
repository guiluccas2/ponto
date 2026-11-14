# Guia de uso — Ponto & Horas

## 1. As três telas
- **Hoje**: relógio, botão de bater o ponto, resumo do dia e anotações.
- **Mês**: totais do mês, lista de todos os dias, exportação.
- **Ajustes**: jornada, horas extras, sincronização e backup.

## 2. Primeira configuração (uma vez)
1. Ajustes → Jornada de trabalho: horas de cada dia da semana (ex.: Seg–Sex 8:00, Sáb 0:00). Dia sem expediente = 0:00.
2. Tolerância diária: padrão 10 min (regra da CLT).
3. Saldo inicial do banco: se já tem horas acumuladas, informe (ex.: 12:30 ou -3:00).
4. Horas extras: adicional dos dias úteis (50%), de domingos/feriados (100%), valor da hora em R$ (opcional) e se o sábado usa o adicional de domingo.

## 3. Rotina diária
1. Chegou: Hoje → Registrar entrada.
2. Saiu para o almoço: Registrar saída (botão vermelho).
3. Voltou: Registrar volta.
4. Fim do expediente: Registrar saída.
Acompanhe Trabalhado, Jornada prevista, Saldo do dia e Saída prevista (horário em que você completa a jornada).
Escreva o que fez em Anotações do dia — salva sozinho.

Turno que passa da meia-noite: se você bateu entrada ontem e ainda não registrou nada hoje, a saída antes do meio-dia é lançada no dia anterior.

## 4. Corrigir ou lançar dias
- Esqueceu de bater o ponto hoje: Hoje → Editar marcações de hoje.
- Outro dia: Mês → toque no dia.
Na janela: escolha o Tipo do dia, ajuste Entrada/Saída, use + Adicionar intervalo, ✕ para remover, Salvar. Limpar dia apaga tudo do dia.

Tipos de dia:
| Tipo | Efeito |
|---|---|
| Normal | Conta a jornada prevista |
| Feriado | Tudo que trabalhar é extra 100% (nacionais já são automáticos) |
| Folga / DSR | Não exige horas |
| Compensação | Dia de folga que desconta a jornada do banco de horas |
| Atestado / Abono | Dia justificado, não desconta |
| Férias | Não exige horas |
| Falta | Desconta a jornada inteira |

Dia útil sem nenhuma marcação não conta (aparece “—”). Para descontar, marque como Falta.
Feriados municipais/estaduais: marque o dia como Feriado manualmente.

## 5. Como as horas são calculadas
- Saldo do dia = trabalhado − previsto. Até a tolerância (10 min), o saldo vira zero; passou disso, conta tudo.
- Horas a mais em dia útil (e sábado, se não marcado como especial) = extra 50%.
- Horas em domingo ou feriado = extra 100%.
- Banco total = saldo inicial + soma dos saldos de todos os dias.
- Valor das extras = valor da hora × horas × (1 + adicional).

## 6. Fechamento do mês
Mês → setas ‹ › para navegar. Veja Trabalhado, Previsto, Extras 50%/100%, Horas faltantes, Saldo do mês, Valor das extras e Banco total.
Dias com número ímpar de marcações aparecem como “incompleto” — corrija.
Exportar planilha (CSV) abre no Excel; Imprimir / PDF gera o espelho do mês.

## 7. Sincronização (indicador no topo)
| Indicador | Significado |
|---|---|
| ✓ Salvo no GitHub 14:32 | Tudo salvo |
| Alterações pendentes… / Sincronizando… | Enviando |
| Offline · salvo no aparelho | Sem internet; envia quando voltar |
| ⚠ mensagem | Erro (ex.: token vencido) — veja Ajustes |
| Somente neste aparelho | Sincronização não configurada |
Toque no indicador para sincronizar na hora. Os aparelhos se atualizam a cada 30 s e ao reabrir o app.
Evite editar o mesmo dia em dois aparelhos ao mesmo tempo: vale a última alteração daquele dia.

## 8. Backup
Ajustes → Baixar backup (JSON) de vez em quando. Restaurar backup mescla o arquivo com os dados atuais.
O repositório ponto-dados no GitHub também guarda o histórico de todas as alterações.
