# Base image: VSCode devcontainer Ubuntu
FROM mcr.microsoft.com/devcontainers/base:resolute

# Install required dependencies for Bun
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

# Install Bun to /usr/local/bin (available for all users)
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

# Set default user to vscode
USER vscode