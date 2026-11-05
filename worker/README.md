# Serviço Mercado Livre (Cloudflare Workers)

Este serviço conecta o painel à API oficial do Mercado Livre usando uma conta separada da conta da loja. Ele busca, uma vez por dia:

- as **buscas em alta** de cada categoria escolhida (as que mais cresceram, as mais desejadas e as mais populares);
- os **20 mais vendidos** de cada categoria, com preço, vendedor e se está no Full, guardando o histórico para mostrar quem subiu e quem caiu;
- os **primeiros anúncios** de cada termo de busca (concorrentes).

A Secret Key e o acesso à conta ficam guardados no Cloudflare. O painel só fala com o serviço usando a chave `APP_KEY`.

## Passo a passo (uma vez só)

### 1. Criar o aplicativo no Mercado Livre

1. Entre no Mercado Livre com a **conta que vocês não usam**.
2. Abra <https://developers.mercadolivre.com.br/devcenter> e clique em **Criar aplicação**.
3. Preencha nome e descrição (ex.: "Pesquisa de mercado Laser Brindes").
4. Em **URI de redirect**, coloque por enquanto `https://example.com/auth/callback`. Você troca no passo 3, quando souber o endereço do serviço.
5. Em permissões, marque leitura (*read*) e acesso offline (*offline_access*), se aparecerem.
6. Salve e anote o **App ID** e a **Secret Key**. A Secret Key não deve ser colada no painel nem enviada para ninguém.

### 2. Subir o serviço no Cloudflare

1. Crie uma conta gratuita em <https://dash.cloudflare.com>.
2. Vá em **Workers & Pages → KV → Create namespace**, dê o nome `ml-laser-brindes` e copie o **ID**.
3. No arquivo `wrangler.toml` desta pasta, troque `COLE_AQUI_O_ID_DO_KV` pelo ID copiado.
4. No computador, dentro desta pasta `worker`, rode:

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

5. Cadastre as três variáveis secretas (o comando pede o valor de cada uma):

```bash
npx wrangler secret put ML_APP_ID
```

```bash
npx wrangler secret put ML_SECRET
```

```bash
npx wrangler secret put APP_KEY
```

`APP_KEY` é uma senha que você inventa (ex.: 20 letras e números aleatórios). Ela é a mesma que vai no painel.

Sem computador, dá para fazer pelo site do Cloudflare: **Workers & Pages → Create → Worker**, colar o conteúdo de `src/index.js`, ligar o KV com o nome de variável `ML_KV` em **Settings → Bindings**, cadastrar as três variáveis em **Settings → Variables and Secrets**, e criar o agendamento diário em **Settings → Triggers → Cron** com `17 9 * * *`.

### 3. Ajustar o endereço no Mercado Livre

O Cloudflare mostra o endereço do serviço, algo como `https://ml-laser-brindes.SEU-USUARIO.workers.dev`. Volte ao aplicativo no Mercado Livre e troque a URI de redirect para:

```
https://ml-laser-brindes.SEU-USUARIO.workers.dev/auth/callback
```

### 4. Ligar no painel

1. No painel, abra a aba **Mercado ML**.
2. Cole o endereço do serviço e a `APP_KEY`, e clique em **Salvar** e depois em **Testar**.
3. Abra uma **janela anônima** no navegador, entre no Mercado Livre com a conta que vocês não usam, e clique em **Conectar conta do ML** no painel. Autorize o aplicativo.
4. Em **Categorias e termos**, busque "adesivo dtf uv", adicione a categoria e clique em **Atualizar do ML**.

Dentro do claude.ai a página não consegue chamar sites de fora. Nesse caso use **Baixar dados do ML** e depois **Importar arquivo baixado**. Abrindo o `index.html` do GitHub, o botão **Atualizar do ML** funciona direto.

## Endereços do serviço

| Endereço | Para quê |
|---|---|
| `/` | Mostra qual conta do ML está conectada |
| `/auth/start?key=APP_KEY` | Começa a conexão com a conta do ML |
| `/auth/callback` | Volta do Mercado Livre depois de autorizar |
| `/api/status?key=APP_KEY` | Diz se o serviço e a conta estão funcionando |
| `/api/categorias?key=APP_KEY&q=texto` | Acha o código da categoria (ex.: MLB1234) |
| `/api/mercado?key=APP_KEY&cats=MLB1234&termos=a,b` | Devolve buscas em alta, mais vendidos e concorrentes (`&download=1` baixa o arquivo, `&forcar=1` ignora o que já foi coletado hoje) |

## Cuidados

- O serviço usa só a API oficial e faz poucas centenas de chamadas por dia, bem abaixo dos limites do Mercado Livre. Não raspa páginas do site.
- O Mercado Livre limita o que mostra de anúncios de outros vendedores. A quantidade vendida pode vir arredondada ou não vir. A busca por termo pode ser recusada para alguns aplicativos; nesse caso o painel mostra o aviso e o resto continua funcionando.
- O acesso à conta é renovado sozinho. Se ficar mais de 6 meses sem uso, conecte de novo.

## Teste local

`teste/teste-worker.mjs` roda o serviço inteiro com o Mercado Livre simulado (sem internet):

```bash
node teste/teste-worker.mjs
```
