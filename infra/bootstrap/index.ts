import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const project = gcp.config.project;
if (!project) throw new Error("環境変数 GOOGLE_PROJECT に GCP のプロジェクト ID を入れる");
const billingAccount = process.env.GCP_BILLING_ACCOUNT;
if (!billingAccount) throw new Error("環境変数 GCP_BILLING_ACCOUNT に請求先アカウント ID を入れる");
const githubRepositoryId = new pulumi.Config().require("githubRepositoryId");
// infra/README.md の手順で gcloud が作る。Pulumi の状態の置き場なので、Pulumi では作らない。
const stateBucket = `${project}-pulumi-state`;

const apis = [
  "run.googleapis.com",
  "artifactregistry.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "sts.googleapis.com",
  "billingbudgets.googleapis.com",
].map((service) => new gcp.projects.Service(service, { service, disableOnDestroy: false }));
const afterApis = { dependsOn: apis };

// ロールは付けない。標準出力は Cloud Run が Cloud Logging に送る。
const runSa = new gcp.serviceaccount.Account(
  "run",
  { accountId: "ga-rules-run", displayName: "ga-rules Cloud Run" },
  afterApis,
);

const deploySa = new gcp.serviceaccount.Account(
  "deploy",
  { accountId: "ga-rules-deploy", displayName: "ga-rules GitHub Actions deploy" },
  afterApis,
);
const deployMember = pulumi.interpolate`serviceAccount:${deploySa.email}`;
for (const role of [
  // invokerIamDisabled（認証なしの公開）を設定するのに run.services.setIamPolicy が要る
  "roles/run.admin",
  // リポジトリとクリーンアップポリシーを作る。writer では作れない
  "roles/artifactregistry.admin",
]) {
  new gcp.projects.IAMMember(`deploy-${role}`, { project, role, member: deployMember });
}
new gcp.serviceaccount.IAMMember("deploy-act-as-run", {
  serviceAccountId: runSa.name,
  role: "roles/iam.serviceAccountUser",
  member: deployMember,
});
new gcp.storage.BucketIAMMember("deploy-state", {
  bucket: stateBucket,
  role: "roles/storage.objectAdmin",
  member: deployMember,
});

const pool = new gcp.iam.WorkloadIdentityPool(
  "github",
  { workloadIdentityPoolId: "github", displayName: "GitHub Actions" },
  afterApis,
);
const provider = new gcp.iam.WorkloadIdentityPoolProvider("github-actions", {
  workloadIdentityPoolId: pool.workloadIdentityPoolId,
  workloadIdentityPoolProviderId: "github-actions",
  oidc: { issuerUri: "https://token.actions.githubusercontent.com" },
  attributeMapping: {
    "google.subject": "assertion.sub",
    "attribute.repository_id": "assertion.repository_id",
    "attribute.ref": "assertion.ref",
  },
  // 名前ではなく ID で絞る。名前で絞ると、改名や削除のあとに同じ名前で作られた別のリポジトリが通る。
  attributeCondition: `assertion.repository_id == "${githubRepositoryId}" && assertion.ref == "refs/heads/main"`,
});
new gcp.serviceaccount.IAMMember("deploy-wif", {
  serviceAccountId: deploySa.name,
  role: "roles/iam.workloadIdentityUser",
  member: pulumi.interpolate`principalSet://iam.googleapis.com/${pool.name}/attribute.repository_id/${githubRepositoryId}`,
});

// 予算アラートは使用を止めない。請求の上限は infra/app の最大インスタンス数 1 で付ける。
// 予算の通貨は請求先アカウントの通貨（JPY）と揃えないと作れない。
const projectNumber = gcp.organizations.getProjectOutput({ projectId: project }).number;
new gcp.billing.Budget(
  "budget",
  {
    billingAccount,
    displayName: "ga-rules",
    budgetFilter: { projects: [pulumi.interpolate`projects/${projectNumber}`] },
    amount: { specifiedAmount: { currencyCode: "JPY", units: "1000" } },
    thresholdRules: [0.5, 0.9, 1].map((thresholdPercent) => ({ thresholdPercent })),
  },
  afterApis,
);

export const workloadIdentityProvider = provider.name;
export const deployServiceAccount = deploySa.email;
export const runServiceAccount = runSa.email;
