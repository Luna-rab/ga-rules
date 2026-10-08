# Base image: VSCode devcontainer Ubuntu
FROM mcr.microsoft.com/devcontainers/base:resolute

# Install required dependencies for Bun
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

# Install Bun to /usr/local/bin (available for all users)
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

# infra/ の Pulumi.yaml の runtime: bun は、Pulumi CLI 3.227.0 未満では動かない。
RUN curl -fsSL https://get.pulumi.com | sh -s -- --version 3.268.0 --install-root /usr/local --no-edit-path

# Google Cloud CLI。devcontainer の feature は apt-key を使い、apt-key の無い Ubuntu 26.04 で失敗するので、公式の手順で入れる。
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y google-cloud-cli && rm -rf /var/lib/apt/lists/*

# gcloud の認証を volume に残し、コンテナを作り直しても再ログインせずに済むようにする。
# 空の volume は、イメージにあるディレクトリの所有者を引き継ぐので、先に vscode の持ち物として作る。
RUN mkdir -p /home/vscode/.config/gcloud && chown -R vscode:vscode /home/vscode/.config

# Set default user to vscode
USER vscode