# README-DEV — この fork（dev ブランチ）について

このドキュメントは、upstream（[rathlinus/gravit-designer](https://github.com/rathlinus/gravit-designer)）を fork した本リポジトリの `dev` ブランチが、**何を・なぜ・どう変更したか**を、あとから読む人が文脈なしで理解できるように残すものです。

## TL;DR

- upstream は「ローカルの Express サーバーで動かす Gravit Designer」だった
- `dev` ブランチはそれを **サーバーなしの完全静的サイト**に変換し、GitHub Pages でホストしている
  → **https://lzpel.github.io/gravit-designer/**
- さらに upstream が削除していた**純正クラウド UI を復元**し、保存先を **Google Drive**（各ユーザー自身のアカウント）に接続した。保存・読み込み・5分間隔の自動保存まで動く
- `main` ブランチは upstream 追従用で**一切変更していない**。変更はすべて `dev`

---

## 1. 前提: upstream の構成

Gravit Designer（旧 Corel Vector）は本来 Corel のクラウドサーバーとセットの Web アプリ。upstream の rathlinus 版は、リバースエンジニアリングによってこれをローカル実行可能にしたもので、構成は:

| 要素 | 役割 |
|---|---|
| `public/` | アプリ本体（webpack バンドル群 + アセット）。完全にクライアントサイド |
| `server.js` + `routes/` | Express。`public/` の静的配信と、**Corel クラウド API のモック**（`/license` `/user` `/subscription/*` などに Pro ライセンス扱いの固定 JSON を返す）と、ライセンス配信 WebSocket |
| `reverse-engineering/` | バンドルを 965 個のモジュールソースに分解したもの（後述、本 fork の変更手段） |
| `public/designer.browser.original.js` | 改変前のオリジナルバンドル（削除されたコードの復元元） |

つまり「サーバー」と言っても実体は**静的配信＋固定レスポンス**だけで、状態を持たない。これが静的サイト化できる根拠になった。

## 2. 変更方針

### 方針A: サーバーの役割をブラウザ内 shim で置き換える（静的化）

**`public/static-shim.js`**（新規、`index.html` で全バンドルより先にロード）が Express の役割をすべて肩代わりする:

1. **モック API の再現** — `window.fetch` と `XMLHttpRequest` をモンキーパッチし、`/license` `/user` などへの同一オリジンリクエストを横取りして、`server.js` / `routes/user.js` と同一の JSON を返す。アプリ側のコードは無改変で「サーバーがいる」と思ったまま動く
2. **ライセンス WebSocket の偽装** — `window.WebSocket` をパッチし、`/license/license` への接続には Pro ライセンスを配信して ping/pong に応える偽ソケットを返す
3. **サブパス補正** — アプリはドメインルート配信前提で `history.pushState("/")` や Service Worker 登録を行うため、GitHub Pages のサブパス（`/gravit-designer/`）配下に URL をリベースする
4. **Google Drive 設定の配布**（後述 §4）

デプロイは `.github/workflows/pages.yml`（新規）が `dev` への push で `public/` をサイトルート、`docs/` を `/docs` に配置して Pages に上げる。

### 方針B: コードの改変は「モジュールソース編集 → リビルド」で行う

`public/designer.browser.dev.js`（メインバンドル、178k行）は直接編集しない。upstream 付属のツールチェーンにより、このバンドルは
`reverse-engineering/src/modules/`（965 モジュール）から再生成できる:

```bash
node reverse-engineering/build-bundle.cjs   # = npm run build
# → public/designer.browser.dev.js を再生成
```

変更はモジュールソース側に加えてリビルドする。これにより diff がモジュール単位で追跡でき、upstream の更新とも突き合わせやすい。

### 方針C: 自前 UI は書かず、削除された純正 UI を復元する

upstream はクラウド保存 UI を削除していたが、調査の結果、削られていたのは**ごく一部**だった:

- `reverse-engineering/src/modules/1483_module.js` — アクション登録配列から `gravit-cloud.open` / `gravit-cloud.save-as` / クラウド同期系の **4 エントリ**
- `reverse-engineering/src/modules/1544_module.js` — 新規ドキュメント/ウェルカムダイアログが簡略版に差し替え（クラウド保存ペイン `saveCloudFile` ごと欠落）

一方、クラウド機能の**下回り**（Drive ストレージ実装 `GGoogleDriveStorage`、Google Picker 連携、GIS 認証クライアント、autosave ワーカーの Drive 分岐、Files Panel）は**すべてバンドル内に残存**していた。

そこで `public/designer.browser.original.js` から削除前のコードを切り出してモジュールソースに戻し（1483 は 4 行、1544 はファイル丸ごと）、リビルドした。自前 UI を書き足すより、実装量が少なく既存配管との整合が保証される。

### 方針D: 保存先は「Gravit Cloud の偽装」ではなく「純正 Google Drive 統合」

Corel クラウドの `/file` REST API 一式（約 15 エンドポイント + 署名付き URL + autosave ワーカーのパッチ）を Google Drive に偽装する案も検討したが、**アプリに元から入っている Google Drive 外部ストレージ機能を有効化する方が実装量が 1/10** で済み、Picker・自動保存・履歴・トークン更新がすべてネイティブに動くため、こちらを採用した。

この純正 Drive 統合はサーバー非依存で、認証は GIS（`google.accounts.oauth2.initTokenClient`）、Drive API へは `fetch` + `Authorization: Bearer` で直接アクセスする。唯一サーバーに頼っていたのが「クライアント設定の配布」1 エンドポイントで、それを shim が返す（§4）。

## 3. 使い方（エンドユーザー視点）

1. https://lzpel.github.io/gravit-designer/ を開く
2. ファイルパネル（Open from Gravit Designer / `Shift+Ctrl+O`）→ ドライブ切替 → **Connect new Cloud drive → Google Drive** → 自分の Google アカウントでサインイン
3. 「Open files...」で Google Picker が開き、Drive 上のファイルを選択して開ける
4. 保存はクラウド保存ダイアログ（`Shift+Ctrl+S`）で Google Drive を選択
5. Drive 上のファイルを開いて編集すると **5 分間隔で自動保存**される（初回のみ「バージョン履歴は作られない」旨の確認ダイアログが出る）

制約:
- スコープは `drive.file`（このアプリが作成したファイル＋ Picker で明示的に選んだファイルのみアクセス可能）。Drive 全体は見えないが、これは仕様であり安全側の設計
- 共有・コメント等のコラボ機能は Corel の corporate 契約専用ガードがあるため動かない

## 4. 認証情報はどこにあり、なぜ公開して許容されるのか

### 何がどこに入っているか

| 値 | 置き場所 | 公開される? |
|---|---|---|
| OAuth **クライアント ID** | `public/static-shim.js` 内の `GDRIVE_CONFIG_CIPHER`（AES 暗号文） | はい（リポジトリ + 配信サイト） |
| **API キー**（Picker 用 developerKey） | 同上 | はい |
| GCP **プロジェクト番号**（Picker 用 appId） | 同上 | はい |
| **client_secret** | **どこにも無い**（コミットしていない） | — |
| ユーザーの**アクセストークン** | 各ユーザー自身のブラウザの `localStorage`（`googleapi_auth_key`）のみ | いいえ |

暗号文の理由: アプリは設定を `GET /cloudservices/googledrive/configuration` から AES 暗号化 JSON として受け取る作りになっており、shim はその形式に合わせて事前暗号化した文字列を返しているだけ。**復号鍵はバンドル内にハードコードされているため、この暗号化に秘匿性はない**。「実質公開の値」として扱っている。

### なぜ許容されるのか

1. **クライアント ID は公開前提の識別子**。Google の設計上、ブラウザ向け OAuth クライアント ID は JS に埋め込んで配布するもので、秘密ではない。悪用は「承認済み JavaScript 生成元」（`https://lzpel.github.io` と `http://localhost:3100` のみ登録）で防がれる — 他のサイトがこの ID でトークンを取ることはできない
2. **client_secret を使わないフロー**。GIS のトークンモデル（暗黙的取得）は client_secret 不要のため、そもそも秘密がフロントエンドに存在しない
3. **API キーはリファラー制限＋ API 制限で無害化**。ブラウザ用 API キーも公開前提だが、無制限だと第三者が自分のサイトからこのキーでクォータを消費できる。Cloud Console で HTTP リファラーを上記 2 origin に、対象 API を Picker/Drive に制限してあれば、漏れても使い道がない
4. **ユーザーデータに触れる鍵は存在しない**。Drive の中身にアクセスできるのはアクセストークンだけで、それは各ユーザーが自分で同意して自分のブラウザに保存するもの。リポジトリ・Pages・第三者からは見えない

まとめると、コミットされているのは「どの GCP プロジェクトか」を示す**識別子**だけで、「何かにアクセスできる**資格情報**」は一切含まれない。

### 自分の GCP プロジェクトに差し替えるには

1. GCP でプロジェクト作成 → **Drive API / Picker API を有効化**
2. OAuth 同意画面を設定（テストモードならテストユーザーに自分を追加。`drive.file` は審査不要スコープなので本番公開も可）
3. OAuth クライアント ID（ウェブアプリ）を作成し、承認済み JavaScript 生成元に配信 origin を登録
4. API キーを作成し、リファラー制限 + API 制限をかける
5. 平文 `{"GOOGLE_DRIVE_PUBLIC_CLIENT_ID":"...","GOOGLE_DRIVE_PUBLIC_API_KEY":"...","GOOGLE_DRIVE_APP_ID":"<プロジェクト番号>"}` を、バンドル内 `encrypt()` と同じ方式（CryptoJS AES-CBC / OpenSSL 形式 / 鍵 = `SHA256("#a09j!@10jas-109827s*%#1098XAapoc-9908#!123")` を Latin1 経由で WordArray 化 / ランダム IV を hex で `"<ivHex>:<base64>"` 連結）で暗号化し、`static-shim.js` の `GDRIVE_CONFIG_CIPHER` を差し替える

## 5. 開発メモ

```bash
# ローカル実行（Express 版。Pages と同等の動作確認は shim があるので静的でも可）
npm install && npm start        # http://localhost:3100

# バンドル再生成（モジュールソースを編集したら必ず実行）
npm run build                   # = node reverse-engineering/build-bundle.cjs

# デプロイ
git push origin dev             # → .github/workflows/pages.yml が Pages に配信
```

- Pages はブラウザ/CDN キャッシュ（max-age=600）があるため、デプロイ直後はハードリロード（Ctrl+Shift+R）で確認すること
- `main` は upstream 追従用。機能変更は `dev` にのみコミットする

## 6. dev ブランチのコミット構成（変更の全体像）

1. **静的化** — `static-shim.js`（モック API / WS 偽装）+ `pages.yml` + index.html への shim 追加
2. **サブパス補正** — pushState / Service Worker 登録 URL のリベース
3. **クラウド UI 復元 + Drive 有効化** — モジュール 1483 / 1544 の復元、リビルド、Drive 設定配布ルート
4. **仕上げ** — クラウドドキュメントが叩く副次エンドポイント（annotations / usage 等）のモック、autosave デフォルト ON シード
