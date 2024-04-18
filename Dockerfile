FROM mcr.microsoft.com/azure-functions/node:4.33.1-node20

# install libxml2-utils for xmllint
RUN \
    apt-get update && \
    apt-get install -y git libxml2-utils

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

# Install application
COPY . /home/site/wwwroot

# Install node_modules 
WORKDIR /home/site/wwwroot
RUN \
    npm i -g npm@^10 && \
    npm pkg delete scripts.prepare && \
    npm ci --production
