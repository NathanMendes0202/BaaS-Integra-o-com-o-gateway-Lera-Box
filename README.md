# BaaS — Integração com o gateway Lera Box

Aplicação feita para o desafio técnico da VBA Systems. Com ela você cria links de pagamento (Pix e cartão), acompanha transações, saldo e extrato, pede saques e configura webhooks. O gateway Lera Box só processa os pagamentos.

Este guia mostra como rodar tudo com **Docker**, do zero.

## O que você precisa

- **Docker Desktop** instalado e **aberto** (no Windows, espere o ícone ficar verde).
- Um **e-mail e telefone reais** para criar a conta no gateway (ele envia documento e senha por e-mail).

## 1. Subir o projeto

Abra o terminal (PowerShell) na pasta do projeto:

```powershell
Copy-Item .env.example .env
```

Abra o arquivo `.env` e troque os valores que começam com `troque-` por qualquer texto seu:

- `DB_PASSWORD` e `DB_ROOT_PASSWORD`: senhas do banco.
- `JWT_SECRET`: um texto grande (32 letras ou mais).
- `ENCRYPTION_KEY`: outro texto grande.

Depois suba tudo:

```powershell
docker compose up --build
```

Na primeira vez demora alguns minutos. Quando parar de rolar texto, está pronto:

| O quê | Endereço |
|---|---|
| Sistema (frontend) | http://localhost:8080 |
| API | http://localhost:3000/api |
| Documentação (Swagger) | http://localhost:3000/api/docs |
| Caixa de e-mails de teste | http://localhost:8025 |

Para parar: `Ctrl + C`. Para subir de novo: `docker compose up`.

## 2. Gerar a URL pública (para os webhooks)

O gateway avisa quando um pagamento termina chamando a sua API. Como a sua API está no seu computador, ele precisa de uma URL pública. Abra **outro terminal** e rode:

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:3000
```

Procure no texto que aparece uma linha parecida com:

```
https://alguma-coisa-aleatoria.trycloudflare.com
```

Essa é a sua URL pública. **Deixe esse terminal aberto** enquanto estiver testando.

## 3. Primeiros passos no sistema

1. Abra http://localhost:8080 e clique em **Criar conta**.
2. Vá em **Conta no gateway**, cadastre-se com e-mail e telefone reais e espere o e-mail do gateway. Depois conecte usando o documento e a senha que chegaram.
3. Vá em **Webhooks**, cole a URL pública do passo 2 no campo "URL pública da API" (sem barra no final) e clique em cadastrar. Use sempre a URL do túnel, nunca a do gateway.
4. Vá em **Links de pagamento** e crie um link Pix ou cartão.
5. Abra o link, pague e veja o resultado em **Transações**, **Carteira** e **Saques**.

O botão **E-mail** do link manda a mensagem para a caixa de teste em http://localhost:8025.

## Cartões para testar

O sistema reconhece a bandeira pelo número. O link só aceita a bandeira que você escolheu ao criá-lo, então use o cartão da mesma bandeira.

| Bandeira | Número | 
|---|---|
| Visa | `4111 1111 1111 1111` ou `4012 8888 8888 1881` |
| Mastercard | `5555 5555 5555 4444` ou `5105 1051 0510 5100` |
| Elo | `6362 9700 0045 7013` ou `5066 9911 1111 1118` |

Nos outros campos, vale qualquer coisa que pareça real:

- **Validade:** qualquer data futura (por exemplo `12/30`).
- **CVV:** 3 números (por exemplo `123`).
- **Nome:** qualquer nome.
- **CPF:** o gateway aceita fictício, mas o campo precisa ter o tamanho certo (11 números).

Esses números são cartões de teste muito usados e passam na validação do sistema. No ambiente de simulação, o gateway aprova ou nega **de forma aleatória**. Se o pagamento for recusado, não é erro seu: tente de novo. O link aceita até 5 tentativas.

## Problemas simples

**"Cannot connect to the Docker daemon" ou o Docker não responde**
O Docker Desktop está fechado. Abra e espere ele iniciar.

**Erro "defina DB_PASSWORD no .env" (ou JWT_SECRET, ENCRYPTION_KEY)**
O arquivo `.env` não existe ou está com campo vazio. Refaça o `Copy-Item .env.example .env` e preencha.

**"port is already allocated" (porta ocupada)**
Algum programa usa a porta 3000, 8080 ou 8025. Feche-o e rode de novo.

**Mudei o `.env` e nada mudou**
Rode `docker compose up --build` outra vez.

**Quero começar do zero (apagar banco e dados)**
```powershell
docker compose down -v
docker compose up --build
```

**O sistema abre, mas o login dá erro**
Espere uns segundos: a API demora um pouco mais que o frontend para ligar no primeiro start.

**A URL pública mudou**
Isso é normal. Cada vez que você roda o comando do túnel, a URL é nova. Cadastre de novo em **Webhooks** com a URL nova.

**O webhook não chega / o pagamento fica "Pendente"**
Confira se o terminal do túnel ainda está aberto e se a URL cadastrada é a atual. Enquanto isso, o botão **Já paguei** (Pix) e **Verificar no gateway** (Transações) consultam o gateway direto e atualizam o status.

**"A URL do gateway não pode ser usada"**
Você colou `api.branchpay.com.br`. Cole a URL do seu túnel (`...trycloudflare.com`).

**Este link aceita apenas cartões de outra bandeira**
Você está usando um cartão de bandeira diferente da escolhida no link. Use o cartão da mesma bandeira ou crie um link novo.

**Bandeira não reconhecida**
O gateway só aceita Visa, Mastercard e Elo. Use um dos números da tabela acima.

**O Pix sumiu / ficou "Expirado"**
O Pix vale por 30 minutos. Crie um link novo.

**O saque deu erro**
O saque funciona apenas por **chave Pix**. Confira se a chave foi digitada certinho.

## Demonstração

Crie um usuário em `/cadastro`. Não compartilhe a senha do e-mail usado no gateway.
