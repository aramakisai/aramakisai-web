FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Enable pnpm via corepack (version pinned in frontend/package.json -> packageManager)
RUN corepack enable

# Python 3 runtime (required by pre-commit local hook check-confidential-info.py)
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

# Infisical CLI (secret injection, see .infisical.json)
RUN curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | bash \
    && apt-get update && apt-get install -y --no-install-recommends infisical \
    && rm -rf /var/lib/apt/lists/*

# gitleaks (used by pre-commit; install standalone binary for local scans)
ARG GITLEAKS_VERSION=8.23.0
RUN ARCH="$(dpkg --print-architecture)" \
    && case "$ARCH" in amd64) GL_ARCH=x64 ;; arm64) GL_ARCH=arm64 ;; *) GL_ARCH="$ARCH" ;; esac \
    && curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GL_ARCH}.tar.gz" \
       -o /tmp/gitleaks.tar.gz \
    && tar -xzf /tmp/gitleaks.tar.gz -C /usr/local/bin gitleaks \
    && rm /tmp/gitleaks.tar.gz
