# Publish Play Pipeline — setup do Bruno (uma vez)

**Contexto (T54 + T56 Fable):** o workflow `.github/workflows/publish-play.yml`
faz build TWA + upload no Google Play sem humano no meio. Precisa de 4 secrets
cravados **na conta ORG MEDFAST** (a pessoal foi rejeitada por politica Play).

Passos abaixo pra rodar UMA UNICA VEZ, depois todos releases sobem via
`Actions → Publish TWA to Google Play → Run workflow`.

---

## 1. Service Account do Google Play (secret `PLAY_SERVICE_ACCOUNT_JSON`)

**Pre-requisitos:**
- Conta ORG MEDFAST verificada no Play Console
- App `br.app.sanova` transferido da pessoal pra org
- Acesso como Admin no Play Console + acesso ao Google Cloud Console
  (mesma conta Google logada nos dois)

**Passo a passo:**

### 1.1 No Google Cloud Console
1. Abrir https://console.cloud.google.com/
2. Trocar pra projeto do Play (dropdown topo). Se nao existir: criar
   projeto "sanova-play" (name livre)
3. Menu ☰ → **IAM & Admin** → **Service Accounts**
4. **Create Service Account**
   - Name: `sanova-play-publisher`
   - Description: `CI/CD publish para br.app.sanova`
   - Skip roles (nada precisa aqui — permissao real vem no Play Console)
5. Clicar na SA criada → aba **Keys** → **Add Key** → **Create new key**
   → **JSON** → download. Guarda o arquivo (nao commita nada).

### 1.2 No Google Play Console
1. Abrir https://play.google.com/console/
2. **Configuracao → Acesso de API** (Setup → API access)
3. Aceitar termos se pedir
4. Achar a SA `sanova-play-publisher@...iam.gserviceaccount.com` na lista
   → **Grant access**
5. Aba **App permissions** → adicionar `Sanova` (br.app.sanova)
6. Aba **Account permissions** → marcar:
   - **Release apps to testing tracks** (obrigatorio)
   - **Manage store presence** (opcional — deixa se quiser automatizar
     descricoes/screenshots futuras)
7. **Invite user** / **Save**
8. Aguardar propagacao (~1 min)

### 1.3 No GitHub
1. Abrir https://github.com/sanovaapp/sanova/settings/secrets/actions
2. **New repository secret**
   - Name: `PLAY_SERVICE_ACCOUNT_JSON`
   - Value: cole o CONTEUDO INTEIRO do JSON baixado no 1.1.5 (o arquivo
     todo, comecando em `{` terminando em `}`, incluindo `private_key`
     com `\n` literal)
3. **Add secret**

---

## 2. Upload keystore permanente (secrets `TWA_UPLOAD_*`)

**Por que:** cada build TWA precisa ser assinado com a MESMA keystore.
Google Play registra a SHA-256 da 1a upload key e rejeita builds com
SHA diferente. Se ficar gerando keystore aleatoria a cada CI run, o
upload falha em 100% das vezes.

**Recomendacao:** cravar isso **antes** do 1o upload pela conta org, ja
que o Play vai pedir uma upload key durante o setup.

### 2.1 Gerar keystore (rodar local ou em qualquer bash)
```bash
keytool -genkeypair \
  -keystore sanova-upload.keystore \
  -alias android -keyalg RSA -keysize 2048 -validity 36500 \
  -dname "CN=Sanova, OU=Sanova, O=MEDFAST, L=BeloHorizonte, ST=MG, C=BR"
# Vai pedir 2 senhas (store password e key password). Use senhas fortes
# e ANOTA — nao tem como recuperar depois. Podem ser iguais.
```

### 2.2 Converter pra base64 single-line
```bash
openssl base64 -in sanova-upload.keystore -out ks.b64 -A
# ks.b64 tem 1 linha unica sem quebras
cat ks.b64  # copiar essa string inteira
```

### 2.3 Cravar 3 secrets no GitHub
1. `TWA_UPLOAD_KEYSTORE_B64` — cola o conteudo do `ks.b64`
2. `TWA_UPLOAD_STORE_PWD` — senha da keystore (store password)
3. `TWA_UPLOAD_KEY_PWD` — senha do alias (key password)

### 2.4 Backup local
Guarda `sanova-upload.keystore` + senhas num vault seguro (1Password,
Bitwarden, KeePass). Se perder, nao consegue mais atualizar o app na
Play Store (fica so o Play App Signing pra girar upload key, processo
manual de 1-2 dias).

---

## 3. Primeiro run do workflow

Depois dos 4 secrets cravados:

1. Actions → **Publish TWA to Google Play** → **Run workflow**
2. Track: `internal` (mais seguro pra 1o teste)
3. Status: `draft` (nao dispara nada pros testadores ainda)
4. Roda. Se der verde, ir no Play Console → Internal testing → deve
   ter um draft release com o AAB deste build
5. Se der erro `Package not found` ou `SHA mismatch`, sinal de que
   o Play tem outra upload key registrada. Precisa transferir upload
   key via Play App Signing (form de suporte, 1-2 dias) OU refazer
   keystore matching a que ja esta la.

## 4. Auto-publish em tag `v*`

O workflow tambem dispara em `git tag v3.10.53 && git push --tags`.
Track default = `internal`, status = `draft`. Rebumar pra `closed` +
`completed` no manual dispatch quando quiser passar pros testadores.

## 5. Troubleshooting rapido

| Erro | Causa | Fix |
|---|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON ausente` | Secret nao cravado | passo 1.3 |
| `Package br.app.sanova not found` | App nao existe na conta OU SA sem permissao | passo 1.2 |
| `SHA-256 mismatch` | Keystore diferente do que Play espera | passo 2 completo |
| `The Android App Bundle was not signed` | Bubblewrap nao acessou keystore | conferir `TWA_UPLOAD_*` cravados |
| `Version code already used` | appVersionCode repetido | passar `version_code` maior no dispatch |
