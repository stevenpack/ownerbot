# Ownerbot

Ownerbot answers questions about system ownership. It was aimed at speeding up getting answers to questions about ownership in the Internal Tools room:

Old:
Person: "Hey Internal Tools, what's wrong with Jira?"
Us: "Hi Friend! Dev Tools actually own Jira. Here is there room: http://..."

New:
Person: "@ownerbot jira"
Ownwerbot: "Dev Tools owns Jira. here is their room: http://...

# Tech
Uses Worers and Workers KV.

# Functionality
Supports adding, deleting, querying, exporting and providing help.

# TODO
See todo.txt

# Getting started

## Prerequisites
* NodeJS
* Yarn

# Local

1. Install package dependencies

```
cd ~/path/to/project/root
yarn
```
  
# Testing

`mocha`

# Deployment

Deployment to Cloudflare is automated using the [Serverless Framework](https://serverless.com/framework/docs/providers/cloudflare/). 
To deploy this worker,

1. Ensure you have the following variables set in the environment:

```
export CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>
export CLOUDFLARE_ZONE_ID=<cloudflare-zone-id>
export CLOUDFLARE_AUTH_KEY=<cloudflare-api-key>
export CLOUDFLARE_AUTH_EMAIL=<cloudflare-email>
export CLOUDFLARE_STAGE=<dev|test|prod>
```

2. Run `yarn release`

To deploy, ensure you have the following variables set 