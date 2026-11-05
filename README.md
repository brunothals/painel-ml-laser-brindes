# Painel ML · Laser Brindes

Painel para fechamento do Mercado Livre: importa o relatório de **Vendas** e o relatório de **Anúncios patrocinados (Ads)** exportados do ML e mostra, de forma organizada:

- **Vendas**, uma a uma, com o cálculo passo a passo (receita, tarifas, envio, bônus, reembolsos = Total ML; menos custo do produto, embalagem, Ads e rateio de fixos = lucro).
- **Anúncios por SKU**: vendas, unidades, lucro, margem, giro em 30 dias, % de vendas via Ads e cancelamentos. Cadastro de custo unitário, embalagem e códigos MLB.
- **Ads**: ACOS de cada anúncio comparado ao limite do SKU; veredito de "compensa", "no limite", "não compensa", "fraco" ou "pouca exposição".
- **Gastos**: lançamentos editáveis com **alerta de gasto repetido** (mesmo valor/período, mesma descrição, dois Ads sobrepostos).
- **Fechamentos**: valores a receber por período (data de liberação), gastos rateados por dia, recebido e "faltam".
- **Folha impressa**: base de custo do filme A, filme B (laminação), tintas (preço, ml, consumo por m²) e outros insumos; custo por cm², m², metro linear, por tamanho de folha (29×21, 29×42, 29×50, 29×100, 40×72 ou personalizada) e por peça.
- **Rateio mensal**: custos do mês (energia, imposto, Ads, etc.) divididos entre unidades em partes iguais, por percentual ou valor direto; material gasto no mês (filme e tinta) atribuído à unidade que imprime; resultado por mês, semana, dia e por folha; opção de incluir ou não uma unidade na divisão; botão para lançar a parte de cada unidade em Gastos.
- **Full**: regra a regra, se vale enviar o anúncio ao Mercado Envios Full; compara SKUs FULL × SEMFULL.
- **Regras e cálculo**: todos os limites são editáveis.

## Como usar

- **Online (claude.ai)**: a versão publicada guarda os dados num banco compartilhado entre quem tem acesso à página.
- **Neste repositório**: `index.html` funciona sozinho em qualquer navegador (GitHub Pages ou arquivo local). Nesse modo os dados ficam salvos no próprio navegador (localStorage); use **Importar → Backup** para levar os dados de um computador a outro.

Importar: aba **Importar**, solte o `.xlsx` de Vendas (Vendas → Baixar relatório) e o de Ads (Publicidade → Product Ads → Relatórios). O tipo é detectado pelo cabeçalho. Reimportar o mesmo período não duplica vendas.

## Arquivos

- `index.html` — página completa para abrir direto / GitHub Pages.
- `painel-ml.html` — mesmo conteúdo sem o esqueleto HTML, no formato que o claude.ai publica.

Nenhum dado de vendas fica gravado nestes arquivos.
