# Painel ML · Laser Brindes

Painel para fechamento do Mercado Livre: importa o relatório de **Vendas** e o relatório de **Anúncios patrocinados (Ads)** exportados do ML e mostra, de forma organizada:

- **Seletor no topo: Ambos / DTF UV / Canecas.** Filtra o painel inteiro (resumo, vendas, anúncios, Ads, gastos, fechamentos, Full). A unidade de cada produto é detectada pelo título e pode ser corrigida em Anúncios; cada gasto tem campo de unidade (geral entra pela metade em cada unidade).
- **Resumo** (primeira tela): frases com semáforo verde/amarelo/vermelho (vendas, lucro, Ads, Full, a receber, gastos repetidos, margem), meta do mês com ritmo projetado, comparação com o mês anterior em cada número, três gráficos (vendas por semana, lucro acumulado × mês anterior, para onde vai cada R$ 100) e os 5 melhores / 5 que precisam de ação com frase de ação. Botão **Modo apresentação** esconde abas e filtros e aumenta a fonte.
- **Vendas**, uma a uma, com o cálculo passo a passo (receita, tarifas, envio, bônus, reembolsos = Total ML; menos custo do produto, embalagem, Ads e rateio de fixos = lucro).
- **Anúncios por SKU**: vendas, unidades, lucro, margem, giro em 30 dias, % de vendas via Ads e cancelamentos. Cadastro de custo unitário, embalagem e códigos MLB, um a um ou em lote (tabela ou lista colada `SKU;custo;embalagem`). Alerta de produto vendendo abaixo do custo + tarifas e de margem baixa.
- **Ads**: ACOS de cada anúncio comparado ao limite do SKU; veredito de "compensa", "no limite", "não compensa", "fraco" ou "pouca exposição".
- **Gastos**: lançamentos editáveis com **alerta de gasto repetido** (mesmo valor/período, mesma descrição, dois Ads sobrepostos).
- **Fechamentos**: valores a receber por período (data de liberação), gastos rateados por dia, recebido e "faltam".
- **Folha impressa**: base de custo do filme A, filme B (laminação), tintas (preço, ml, consumo por m²) e outros insumos; custo por cm², m², metro linear, por tamanho de folha (29×21, 29×42, 29×50, 29×100, 40×72 ou personalizada) e por peça. Cada SKU de DTF UV recebe um tamanho de folha, sugerido pelo preço cheio de cada tamanho (29×21 R$ 39, 29×42 R$ 49,90, 29×50 R$ 65,90, 29×100 R$ 99) e pelas medidas do título, editável por SKU; o custo do SKU passa a ser o custo da folha × folhas por venda.
- **Rateio mensal**: custos do mês (energia, imposto, Ads, etc.) divididos entre unidades em partes iguais, por percentual ou valor direto; material gasto no mês (filme e tinta) atribuído à unidade que imprime; resultado por mês, semana, dia e por folha; opção de incluir ou não uma unidade na divisão; botão para lançar a parte de cada unidade em Gastos.
- **Mês a mês**: lucro de cada mês por unidade (gráfico e tabela com Mercado Livre, produto, imposto, Ads, outros gastos, margem e comparação com o mês anterior).
- **Comissões semanais**: quem recebe, percentual, base (lucro após custos, Total ML ou receita) e unidade; valor de cada semana, marcação de pago e ajuste quando uma venda é cancelada depois do pagamento.
- **Catálogo**: lista de todas as artes (colada ou importada) comparada com os SKUs no Mercado Livre (vendas e planilha de anúncios do ML), mostrando o que ainda falta subir, com as de tema em alta primeiro.
- **Tendências dos concorrentes (DTF UV)**: temas em alta no ML (lista editável, começa com o que estava em destaque em 05/11/2026), link de busca de concorrentes por tema, quantas artes vocês têm em cada tema e calendário de datas de hype com prazo para criar e postar.
- **Mercado ML** (concorrentes e mais vendidos): buscas em alta da categoria, os 20 mais vendidos com quem subiu e quem caiu, e os primeiros anúncios de cada termo, puxados pela API oficial do Mercado Livre por uma conta separada. Precisa do serviço da pasta [`worker`](worker/README.md), que roda de graça no Cloudflare.
- **Desconto máximo por folha** (aba Folha impressa): preço mínimo e desconto máximo de cada tamanho antes de dar prejuízo, usando tarifa, frete e Ads reais de cada tamanho.
- **Imposto** como percentual da receita (geral ou por unidade) e **quantidade a enviar ao Full** pelo giro de 30 dias.
- **Full**: regra a regra, se vale enviar o anúncio ao Mercado Envios Full; compara SKUs FULL × SEMFULL.
- **Regras e cálculo**: todos os limites são editáveis.

## Como usar

- **Online (claude.ai)**: a versão publicada guarda os dados num banco compartilhado entre quem tem acesso à página.
- **Neste repositório**: `index.html` funciona sozinho em qualquer navegador (GitHub Pages ou arquivo local). Nesse modo os dados ficam salvos no próprio navegador (localStorage); use **Importar → Backup** para levar os dados de um computador a outro.

Importar: aba **Importar**, solte o `.xlsx` de Vendas (Vendas → Baixar relatório) e o de Ads (Publicidade → Product Ads → Relatórios). O tipo é detectado pelo cabeçalho. Reimportar o mesmo período não duplica vendas e mostra o que mudou (novas, canceladas, reembolsos, diferença no Total ML).

## Arquivos

- `worker/` — serviço que conecta o painel à API do Mercado Livre (passo a passo no README da pasta).

- `index.html` — página completa para abrir direto / GitHub Pages.
- `painel-ml.html` — mesmo conteúdo sem o esqueleto HTML, no formato que o claude.ai publica.

Nenhum dado de vendas fica gravado nestes arquivos.
