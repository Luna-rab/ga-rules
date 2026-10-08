# デプロイの準備（人が手元でやること）

Cloud Run へのデプロイは GitHub Actions の `deploy.yml` が `infra/app` を `pulumi up` して行う。ただし、GCP のプロジェクト・Pulumi の状態バケット・CI が GCP に入るための認証（`infra/bootstrap`）は、CI に IAM を作る権限を渡さないため、人が自分の `gcloud` の認証で作る。

```mermaid
flowchart LR
    A["A. gcloud でプロジェクトと状態バケットを作る"] --> B["B. pulumi up（infra/bootstrap）"]
    B --> C["C. GitHub の repository variables を登録"]
    C --> D["D. deploy.yml を手動で実行"]
```

以下、`<PROJECT_ID>` は GCP のプロジェクト ID（例: `ga-rules-mcp`）、`<BUCKET>` は `<PROJECT_ID>-pulumi-state` に置き換える。

## A. プロジェクトと状態バケットを作る

devcontainer を作り直したあとで行う（`pulumi` と `gcloud` は `.devcontainer/Dockerfile` で入る）。

```sh
gcloud auth login
gcloud auth application-default login   # Pulumi はこちらの認証で GCP を操作する

gcloud projects create <PROJECT_ID>
gcloud billing accounts list            # ACCOUNT_ID を控える
gcloud billing projects link <PROJECT_ID> --billing-account=<ACCOUNT_ID>
gcloud config set project <PROJECT_ID>
gcloud auth application-default set-quota-project <PROJECT_ID>

# 残りの API は infra/bootstrap が有効にする。その操作に要る 2 つだけ先に有効にする
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com

gcloud storage buckets create gs://<BUCKET> --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets update gs://<BUCKET> --versioning   # 状態ファイルを壊したときに戻せるようにする
```

- バケットは `us-central1` に置く。Cloud Storage の無料枠（5GB）は米国の 3 リージョンだけが対象。
- 課金アカウント ID はリポジトリ（公開）に書かない。B で環境変数として渡す。

## B. `infra/bootstrap` を適用する

```sh
export PULUMI_CONFIG_PASSPHRASE=""   # 暗号化して保存する値が無いので空でよい
export GCP_BILLING_ACCOUNT=<ACCOUNT_ID>
export GOOGLE_PROJECT=<PROJECT_ID>   # Pulumi の GCP provider はプロジェクトをこの環境変数から読む
pulumi login gs://<BUCKET>
cd infra/bootstrap
pulumi stack select --create prod
pulumi up
```

予算アラート（¥1,000 の 50%・90%・100%）のメールは、課金アカウントの管理者に届く。予算の通貨は請求先アカウントの通貨と揃える必要があり、このアカウントは JPY。

Compute Engine API が無効だという警告（`failed to get regions list`）が出るが、GCP provider がリージョンの一覧を取れないだけで、適用には影響しない。

## C. GitHub の repository variables を登録する

値は秘密ではないので、secrets ではなく variables に置く。

```sh
cd infra/bootstrap
gh variable set GCP_PROJECT  --body <PROJECT_ID>
gh variable set STATE_BUCKET --body <BUCKET>
gh variable set WIF_PROVIDER --body "$(pulumi stack output workloadIdentityProvider)"
gh variable set DEPLOY_SA    --body "$(pulumi stack output deployServiceAccount)"
```

## D. 初回のデプロイ

```sh
gh workflow run deploy.yml
gh run watch
```

スモークテストの step が通ったら、`infra/app` の出力 `url` が利用者に配る URL になる。

```sh
cd infra/app && pulumi stack output url
```

claude.ai の Customize > Connectors > Add custom connector にこの URL を貼り、`get_game_overview` が呼ばれることを確かめる。

## 注意

- 個人の Gmail アカウントで作ったプロジェクトは組織に属さないので、`allUsers` に公開できる。組織の下に作った場合は、組織ポリシーの「ドメイン制限付き共有」で公開が拒否されることがある。
- WIF は、リポジトリ ID `1395664644`（`Luna-rab/ga-rules`）の main ブランチからの実行だけを通す。リポジトリを作り直すと ID が変わるので、`infra/bootstrap` の設定を直して B をやり直す。
