FROM mcr.microsoft.com/azure-functions/node:4.1055.300-3-node24@sha256:b486c18b822f53f14c71731bad9754daea320f8ab6653b3223a28822c71ec743

# install libxml2-utils for xmllint
RUN \
    apt-get update && \
    apt-get install -y git libxml2-utils

# Fail if the reviewed digest is replaced by an unpatched runtime or CA store.
RUN node -e "if (process.version !== 'v24.22.2') { \
    console.error('Expected v24.22.2, got ' + process.version); process.exit(1) }" && \
    test "$(npm --version)" = '11.19.1'

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

# Install application
COPY . /home/site/wwwroot

# Install node_modules
WORKDIR /home/site/wwwroot
RUN \
    npm pkg delete scripts.prepare && \
    npm ci --omit=dev && \
    npm run security:test
