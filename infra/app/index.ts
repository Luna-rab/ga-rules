import * as dockerBuild from "@pulumi/docker-build";
import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const project = gcp.config.project;
const region = gcp.config.region;
if (!project) throw new Error("環境変数 GOOGLE_PROJECT に GCP のプロジェクト ID を入れる");
if (!region) throw new Error("Pulumi.prod.yaml に gcp:region を書く");

const bootstrap = new pulumi.StackReference("organization/ga-rules-bootstrap/prod");
const runServiceAccount = bootstrap.requireOutput("runServiceAccount");

const repo = new gcp.artifactregistry.Repository("ga-rules", {
  repositoryId: "ga-rules",
  location: region,
  format: "DOCKER",
  // 無料枠 0.5GB に収める。イメージは 1 版 100MB 前後。
  cleanupPolicies: [
    { id: "delete-all", action: "DELETE", condition: { tagState: "ANY" } },
    { id: "keep-recent", action: "KEEP", mostRecentVersions: { keepCount: 3 } },
  ],
  cleanupPolicyDryRun: false,
});

// Dockerfile はこの値が変わると取得から先のキャッシュを捨て、ルールとカードを取り直す。
// 値は毎回変わるので、pulumi up のたびにイメージを作り直す。
const dataVersion = process.env.DATA_VERSION ?? new Date().toISOString().replace(/[-:]|\.\d+/g, "");
const registry = `${region}-docker.pkg.dev`;
const imageName = pulumi.interpolate`${registry}/${project}/${repo.repositoryId}/server`;

const image = new dockerBuild.Image("server", {
  // Pulumi はプロジェクトのディレクトリ（infra/app）で動くので、リポジトリのルートは 2 つ上。
  context: { location: "../.." },
  platforms: ["linux/amd64"],
  buildArgs: { DATA_VERSION: dataVersion },
  // preview のたびに取得から作り直すと 2 分かかるので、preview では作らない。
  buildOnPreview: false,
  push: true,
  tags: [pulumi.interpolate`${imageName}:${dataVersion}`],
  registries: [
    {
      address: registry,
      username: "oauth2accesstoken",
      password: gcp.organizations.getClientConfigOutput().accessToken,
    },
  ],
});

const service = new gcp.cloudrunv2.Service("server", {
  name: "ga-rules",
  location: region,
  ingress: "INGRESS_TRAFFIC_ALL",
  // 認証なしで公開する。claude.ai と ChatGPT のコネクタは URL を貼るだけで使う。
  invokerIamDisabled: true,
  deletionProtection: false,
  template: {
    serviceAccount: runServiceAccount,
    // 請求の上限。濫用されても 1 台分（最悪で月 $60 前後）までしか増えない。
    scaling: { minInstanceCount: 0, maxInstanceCount: 1 },
    timeout: "60s",
    containers: [
      {
        image: pulumi.interpolate`${imageName}@${image.digest}`,
        resources: { limits: { cpu: "1", memory: "512Mi" }, startupCpuBoost: true },
      },
    ],
  },
});

export const url = pulumi.interpolate`${service.uri}/mcp`;
