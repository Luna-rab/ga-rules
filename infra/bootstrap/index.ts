import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const project = gcp.config.project;
const region = gcp.config.region;
if (!project) throw new Error("環境変数 GOOGLE_PROJECT に GCP のプロジェクト ID を入れる");
if (!region) throw new Error("Pulumi.prod.yaml に gcp:region を書く");
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
  "pubsub.googleapis.com",
  "workflows.googleapis.com",
  "eventarc.googleapis.com",
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

// 予算を超えたら Cloud Run の ingress を内部だけにする（理由は DESIGN.md の「配布とホスティング」）。
// infra/app の pulumi up は ingress を全体に戻すので、止まったあとの main への push でも公開が再開する。
const budgetTopic = new gcp.pubsub.Topic("budget", { name: "ga-rules-budget" }, afterApis);

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
    // 閾値に関係なく、集計が更新されるたび（1 日に数回）通知する。メールの宛先はそのまま残る。
    allUpdatesRule: { pubsubTopic: budgetTopic.id, schemaVersion: "1.0" },
  },
  afterApis,
);

const stopperSa = new gcp.serviceaccount.Account(
  "stopper",
  { accountId: "ga-rules-stopper", displayName: "ga-rules budget stopper" },
  afterApis,
);
const stopperMember = pulumi.interpolate`serviceAccount:${stopperSa.email}`;
const stopperRoles: pulumi.Resource[] = ["roles/run.developer", "roles/workflows.invoker"].map(
  (role) => new gcp.projects.IAMMember(`stopper-${role}`, { project, role, member: stopperMember }),
);
// Cloud Run のサービスを書き換えるには、ingress だけを変えるときでも実行用 SA の actAs が要る。
stopperRoles.push(
  new gcp.serviceaccount.IAMMember("stopper-act-as-run", {
    serviceAccountId: runSa.name,
    role: "roles/iam.serviceAccountUser",
    member: stopperMember,
  }),
);

// サービス名は infra/app の cloudrunv2.Service の name と揃える。
const serviceName = `projects/${project}/locations/${region}/services/ga-rules`;
const stopper = new gcp.workflows.Workflow(
  "stopper",
  {
    name: "ga-rules-stopper",
    region,
    serviceAccount: stopperSa.id,
    sourceContents: `
main:
  params: [event]
  steps:
    - decode:
        assign:
          - notice: \${json.decode(base64.decode(event.data.message.data))}
    - underBudget:
        switch:
          - condition: \${notice.costAmount < notice.budgetAmount}
            return: under budget
    - get:
        call: googleapis.run.v2.projects.locations.services.get
        args:
          name: ${serviceName}
        result: service
    - close:
        assign:
          - service.ingress: INGRESS_TRAFFIC_INTERNAL_ONLY
    - patch:
        call: googleapis.run.v2.projects.locations.services.patch
        args:
          name: ${serviceName}
          body: \${service}
    - done:
        return: closed
`,
  },
  afterApis,
);
// 権限より先に作ると、最初の通知で Workflows を起動できない。
new gcp.eventarc.Trigger(
  "budget",
  {
    name: "ga-rules-budget",
    location: region,
    matchingCriterias: [
      { attribute: "type", value: "google.cloud.pubsub.topic.v1.messagePublished" },
    ],
    transport: { pubsub: { topic: budgetTopic.id } },
    destination: { workflow: stopper.id },
    serviceAccount: stopperSa.email,
  },
  { dependsOn: stopperRoles },
);

export const workloadIdentityProvider = provider.name;
export const deployServiceAccount = deploySa.email;
export const runServiceAccount = runSa.email;
