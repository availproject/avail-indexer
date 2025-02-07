# SubQuery - Example Project for Polkadot

[SubQuery](https://subquery.network) is a fast, flexible, and reliable open-source data indexer that provides you with custom APIs for your web3 project across all of our supported networks. To learn about how to get started with SubQuery, [visit our docs](https://academy.subquery.network).

**This SubQuery project indexes all asset transfers using the balances pallet on the Polkadot Network**

## Tl;Dr
```bash
npm install -g @subql/cli@5.2.8
npm install
npm run codegen
npm run build
docker-compose pull
docker-compose up --remove-orphans
```

Or you can use this one-liner which will install dependencies and setup the indexer after taking user inputs for websocket endpoint and genesis hash.
```bash
curl -s https://raw.githubusercontent.com/availproject/avail-indexer/main/setup_indexer.sh -o setup_indexer.sh && bash setup_indexer.sh
``` 

## Start

First, install SubQuery CLI globally on your terminal by using NPM `npm install -g @subql/cli@5.2.8`

You can either clone this GitHub repo, or use the `subql` CLI to bootstrap a clean project in the network of your choosing by running `subql init` and following the prompts.

Don't forget to install dependencies with `npm install` or `yarn install`!

## Editing your SubQuery project

Although this is a working example SubQuery project, you can edit the SubQuery project by changing the following files:

- The project manifest in `project.yaml` defines the key project configuration and mapping handler filters
- The GraphQL Schema (`schema.graphql`) defines the shape of the resulting data that you are using SubQuery to index
- The Mapping functions in `src/mappings/` directory are typescript functions that handle transformation logic

SubQuery supports various layer-1 blockchain networks and provides [dedicated quick start guides](https://academy.subquery.network/quickstart/quickstart.html) as well as [detailed technical documentation](https://academy.subquery.network/build/introduction.html) for each of them.

For `Mainnet`:
```yaml
 genesisHash: '0xb91746b45e0346cc2f815a520b9c6cb4d5c0902af848db0a80f85932d2e8276a'
 endpoint: 'wss://mainnet-rpc.avail.so/ws'
```
For `Turing network`:
```yaml
 genesisHash: '0xd3d2f3a3495dc597434a99d7d449ebad6616db45e4e4f178f31cc6fa14378b70'
 endpoint: 'wss://turing-rpc.avail.so/ws'
```
For `Local network`:
```yaml
 genesisHash: '<local_chain_genesis_hash>'
 endpoint: 'ws://127.0.0.1:9944'
```
For `Local network` with docker:
```yaml
 genesisHash: '<local_chain_genesis_hash>'
 endpoint: 'ws://host.docker.internal:9944'
```

## Run your project

_If you get stuck, find out how to get help below._

The simplest way to run your project is by running `yarn dev` or `npm run-script dev`. This does all of the following:

1. `yarn codegen` - Generates types from the GraphQL schema definition and contract ABIs and saves them in the `/src/types` directory. This must be done after each change to the `schema.graphql` file or the contract ABIs
2. `yarn build` - Builds and packages the SubQuery project into the `/dist` directory
3. `docker-compose pull && docker-compose up` - Runs a Docker container with an indexer, postgresql DB, and a query service. This requires [Docker to be installed](https://docs.docker.com/engine/install) and running locally. The configuration for this container is set from your `docker-compose.yml`

You can observe the three services start, and once all are running (it may take a few minutes on your first start), please open your browser and head to [http://localhost:3000](http://localhost:3000) - you should see a GraphQL playground showing with the schemas ready to query. [Read the docs for more information](https://academy.subquery.network/run_publish/run.html) or [explore the possible service configuration for running SubQuery](https://academy.subquery.network/run_publish/references.html).

## Query your project

For this project, you can try to query with the following GraphQL code to get a taste of how it works.

```graphql
# Query blocks (events, logs, ... can be called separately)
{
  blocks(first: 10, orderBy: TIMESTAMP_DESC) {
    nodes {
      number
      hash
      parentHash
      stateRoot
      timestamp
      runtimeVersion
      extrinsics {
        nodes {
          module
          call
        }
      }
      events {
        nodes {
          module
          call
        }
      }
      logs {
        nodes {
          type
          engine
          data
        }
      }
      headerExtensions {
        nodes {
          version
          commitments {
            nodes {
              rows
              cols
              dataRoot
              commitment
            }
          }
        }
      }
    }
  }
}
# Query session and validators
{
  sessions(
    filter: {
      id: {equalTo: "2907"}
    }
    first: 10
    orderBy: ID_DESC
  ) {
    totalCount
    nodes {
      id
      validators
    }
  }
}
# Query accounts
{
  accountEntities(
    filter: { id: { in: ["5CwCDQKRyPnrSHcmxbS9cEDGb4YQxaVrbQmw9RH5yBR9Xnh5"] } }
  ) {
    nodes {
      id
      amount
      amountTotal
      amountRounded
      amountTotalRounded
    }
  }
}
# Query extrinsics by hash
{
  extrinsics(
    filter: { txHash: { equalTo: "0x06d846527915a9098ac1c995804d1ca37fdf03b51988932a1cf22459e672af1b" } }
    first: 10
  ) {
    nodes {
      id
      txHash
      module
      call
      blockHeight
      success
      isSigned
      extrinsicIndex
      hash
      timestamp
      signer
      signature
      fees
      nonce
      argsName
      argsValue
      nbEvents
    }
  }
}

```

You can explore the different possible queries and entities to help you with GraphQL using the documentation drawer on the right (schema and docs).


## Get help from chat GPT (Change the query between "")
Giving this example requests : 

```graphql
# Copy paste the examples from "Query your project" section
```

And this schema : 
```graphql
# Copy the content of schema.graphql here
```
And the fact that foreign key such as "Block" becomes blockId in a query

Can you generate me a query to : 

"query the first 10 extrinsics where the call is "submitData" ordered by blockId desc ?" 

## When changing the service file
- Put the file in `/etc/systemd/system/`
- `sudo systemctl daemon-reload`
- `sudo systemctl enable start_indexer.service`
- `sudo systemctl start start_indexer.service`
