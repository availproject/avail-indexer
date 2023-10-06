# SubQuery - Example Project for Polkadot

[SubQuery](https://subquery.network) is a fast, flexible, and reliable open-source data indexer that provides you with custom APIs for your web3 project across all of our supported networks. To learn about how to get started with SubQuery, [visit our docs](https://academy.subquery.network).

**This SubQuery project indexes all asset transfers using the balances pallet on the Polkadot Network**

## Start

First, install SubQuery CLI globally on your terminal by using NPM `npm install -g @subql/cli`

You can either clone this GitHub repo, or use the `subql` CLI to bootstrap a clean project in the network of your choosing by running `subql init` and following the prompts.

Don't forget to install dependencies with `npm install` or `yarn install`!

## Editing your SubQuery project

Although this is a working example SubQuery project, you can edit the SubQuery project by changing the following files:

- The project manifest in `project.yaml` defines the key project configuration and mapping handler filters
- The GraphQL Schema (`schema.graphql`) defines the shape of the resulting data that you are using SubQuery to index
- The Mapping functions in `src/mappings/` directory are typescript functions that handle transformation logic

SubQuery supports various layer-1 blockchain networks and provides [dedicated quick start guides](https://academy.subquery.network/quickstart/quickstart.html) as well as [detailed technical documentation](https://academy.subquery.network/build/introduction.html) for each of them.

For `Kate Testnet`:
```yaml
 genesisHash: '0xd12003ac837853b062aaccca5ce87ac4838c48447e41db4a3dcfb5bf312350c6'
 endpoint: 'wss://kate.avail.tools/ws'
```
For `Biryani Devnet`:
```yaml
 genesisHash: '0x25b7a5d31af1def763db74809b08794c4eb2121c531f8fd8458555be487bebda'
 endpoint: 'wss://biryani-devnet.avail.tools/ws'
```

## Run your project

_If you get stuck, find out how to get help below._

The simplest way to run your project is by running `yarn dev` or `npm run-script dev`. This does all of the following:

1. `yarn codegen` - Generates types from the GraphQL schema definition and contract ABIs and saves them in the `/src/types` directory. This must be done after each change to the `schema.graphql` file or the contract ABIs
2. `yarn build` - Builds and packages the SubQuery project into the `/dist` directory
3. `docker-compose pull && docker-compose up` - Runs a Docker container with an indexer, PostgeSQL DB, and a query service. This requires [Docker to be installed](https://docs.docker.com/engine/install) and running locally. The configuration for this container is set from your `docker-compose.yml`

You can observe the three services start, and once all are running (it may take a few minutes on your first start), please open your browser and head to [http://localhost:3000](http://localhost:3000) - you should see a GraphQL playground showing with the schemas ready to query. [Read the docs for more information](https://academy.subquery.network/run_publish/run.html) or [explore the possible service configuration for running SubQuery](https://academy.subquery.network/run_publish/references.html).

## Query your project

For this project, you can try to query with the following GraphQL code to get a taste of how it works.

```graphql
{
  query {
    transfers(first: 5, orderBy: BLOCK_NUMBER_DESC) {
      totalCount
      nodes {
        id
        date
        blockNumber
        toId
        fromId
        amount
      }
    }
    accounts(first: 5, orderBy: SENT_TRANSFERS_COUNT_DESC) {
      nodes {
        id
        sentTransfers(first: 5, orderBy: BLOCK_NUMBER_DESC) {
          totalCount
          nodes {
            id
            toId
            amount
          }
        }
        lastTransferBlock
      }
    }
  }
}
```

You can explore the different possible queries and entities to help you with GraphQL using the documentation draw on the right.
