import { EventRecord, Digest, Header, AccountId } from "@polkadot/types/interfaces"
import { SubstrateExtrinsic, SubstrateBlock } from "@subql/types";
import { Event, Extrinsic, SpecVersion, Block, Session, Log, HeaderExtension, Commitment, AppLookup, AccountEntity, DataSubmission, TransferEntity } from "../types";
import {
  transferHandler,
  updateAccounts
} from "../utils/balances";
import { extractAuthor } from "../utils/author";
import { formatInspect } from "../utils/inspect";
import { getFeesFromEvent, handleDaSubmission, handleVectorExecuteMessage, handleVectorSendMessage } from "../utils/extrinsic";
import { AccounToUpdateValue } from "../types/models/AccounToUpdateValue";

let specVersion: SpecVersion | null = null;
const ENABLE_LOG = false

export const balanceEvents = [
  "balances.BalanceSet",
  "balances.Deposit",
  "balances.DustLost",
  "balances.Endowed",
  "balances.Reserved",
  "balances.Unreserved",
  "balances.Withdraw",
  "balances.Upgraded",
]
export const allBalanceEvents = [
  ...balanceEvents,
  "balances.Slashed",
]
export const feeEvents = ["transactionPayment.TransactionFeePaid"]
export const transferEvents = ["balances.Transfer"]
export const filteredOutEvents = [
  ...balanceEvents,
  ...feeEvents,
  "treasury.Deposit",
  "system.Remarked",
  "system.ExtrinsicSuccess",
  "system.ExtrinsicFailed",
]

// Set timestamp as mandatory, since in `SubstrateBlock` timestamp is now an optional field.
// For us, it will never be empty and this is only to satisfy the compiler.
export interface CorrectSubstrateBlock extends SubstrateBlock {
  timestamp: Date;
}

export async function handleBlock(block: CorrectSubstrateBlock): Promise<void> {
  try {
    const blockNumber = block.block.header.number.toNumber()
    const blockNumberString = blockNumber.toString()
    const blockHash = block.block.header.hash.toString()
    const dbBlock = await Block.get(blockNumberString)
    if (!dbBlock) {
      // Generic block
      if (ENABLE_LOG) logger.info(`Block handler: N°${blockNumberString}`)
      await blockHandler(block, specVersion)

      const events: Event[] = []
      const calls: Extrinsic[] = []
      const daSubmissions: DataSubmission[] = []
      const extIdToDetails: { [key: number]: { nbEvents: number, success?: boolean, fee?: string, feeRounded?: number } } = {}
      const accountToUpdate: string[] = []
      const transfers: TransferEntity[] = []

      // Events count / setup / First filtering
      if (ENABLE_LOG) logger.info(`Block events - ${block.events.length}`)
      block.events.map((evt, idx) => {
        const key = `${evt.event.section}.${evt.event.method}`
        const relatedExtrinsicIndex = evt.phase.isApplyExtrinsic ? evt.phase.asApplyExtrinsic.toNumber() : -1
        if (relatedExtrinsicIndex !== -1) {
          if (extIdToDetails[relatedExtrinsicIndex] === undefined) {
            extIdToDetails[relatedExtrinsicIndex] = {
              nbEvents: 0
            }
          }
          extIdToDetails[relatedExtrinsicIndex].nbEvents += 1
          if (key === 'transactionPayment.TransactionFeePaid') {
            let fees = getFeesFromEvent(evt.event.data.toJSON() as any[])
            extIdToDetails[relatedExtrinsicIndex].fee = fees.fee
            extIdToDetails[relatedExtrinsicIndex].feeRounded = fees.feeRounded
          }
          if (key === 'system.ExtrinsicSuccess') extIdToDetails[relatedExtrinsicIndex].success = true
        }
        if (!filteredOutEvents.includes(key)) {
          events.push(handleEvent(blockNumberString, idx, evt, relatedExtrinsicIndex, block.timestamp))
          // Handle transfers
          if (transferEvents.includes(key)) {
            transfers.push(transferHandler(
              evt,
              blockNumber.toString(),
              blockHash,
              block.timestamp,
              relatedExtrinsicIndex !== -1 ? `${blockNumber}-${relatedExtrinsicIndex}` : "",
              idx
            ))
            const [fromRaw, toRaw, _] = evt.event.data
            const from = fromRaw.toString()
            const to = toRaw.toString()
            if (!accountToUpdate.includes(from)) accountToUpdate.push(from)
            if (!accountToUpdate.includes(to)) accountToUpdate.push(to)
          }
        }

        // Handle account updates
        if ([...allBalanceEvents, ...feeEvents].includes(key)) {
          const [who] = evt.event.data
          const account = who.toString()
          if (!accountToUpdate.includes(account)) accountToUpdate.push(account)
        }
      })
      if (ENABLE_LOG) logger.info(`Block events filtered - ${events.length}`)


      // Extrinsics
      if (ENABLE_LOG) logger.info(`Block Extrinsics - ${block.block.extrinsics.length}`)
      block.block.extrinsics.map((extrinsic, idx) => {
        const methodData = extrinsic.method
        const extrinsicType = `${methodData.section}_${methodData.method}`
        const isDataSubmission = extrinsicType === "dataAvailability_submitData"
        // We use this instead of "wrapExtrinsic" to avoid looping on events
        const substrateExtrinsic: Omit<SubstrateExtrinsic, 'events' | 'success'> = {
          idx,
          extrinsic,
          block,
        }
        const extraData = extIdToDetails[idx]
        calls.push(handleCall(`${blockNumberString}-${idx}`, substrateExtrinsic, extraData))
        if (isDataSubmission) daSubmissions.push(handleDataSubmission(`${blockNumberString}-${idx}`, substrateExtrinsic, extraData))
      })


      // Handle accounts
      let accountToUpdateValue = await AccounToUpdateValue.get("0")
      if (!accountToUpdateValue) {
        accountToUpdateValue = new AccounToUpdateValue("0", [])
      }
      accountToUpdateValue.accounts = [...new Set([...accountToUpdateValue.accounts, ...accountToUpdate])]
      if (accountToUpdateValue.accounts.length >= 100 || (accountToUpdateValue.accounts.length > 0 && blockNumber % 50 === 0)) {
        const accounts = await updateAccounts(accountToUpdateValue.accounts, block.timestamp)
        await Promise.all([
          store.bulkCreate('AccountEntity', accounts.accountsToCreate),
          store.bulkUpdate('AccountEntity', accounts.accountsToUpdate),
        ])
        if (ENABLE_LOG) logger.info(`Saved ${accountToUpdateValue.accounts.length} accounts at block ${blockNumberString}`)
        accountToUpdateValue.accounts = []
      }
      await accountToUpdateValue.save()


      // Save in db in parallel
      if (ENABLE_LOG) logger.info(`Save in db`)
      await Promise.all([
        store.bulkCreate('Event', events),
        store.bulkCreate('Extrinsic', calls),
        store.bulkCreate('DataSubmission', daSubmissions),
        store.bulkCreate('TransferEntity', transfers),
      ]);
      if (ENABLE_LOG) logger.info(`Finished in db`)
    } else {
      if (ENABLE_LOG) logger.info('Block already exist, skipping :)')
    }
  } catch (err: any) {
    logger.error(`record block error at block nb ${block.block.header.number.toNumber()}`);
    logger.error(err.toString());
  }
}

export const blockHandler = async (block: CorrectSubstrateBlock, specVersion: SpecVersion | null): Promise<void> => {
  try {
    const blockHeader = block.block.header
    const blockRecord = new Block(
      blockHeader.number.toString(),
      blockHeader.number.toNumber(),
      blockHeader.hash.toString(),
      block.timestamp,
      blockHeader.parentHash.toString(),
      blockHeader.stateRoot.toString(),
      blockHeader.extrinsicsRoot.toString(),
      block.specVersion,
      block.block.extrinsics.length,
      block.events.length,
    )
    await Promise.all([
      handleLogs(blockHeader.number.toString(), blockHeader.digest),
      updateSession(blockRecord, blockHeader.digest),
      updateSpecversion(specVersion, block.specVersion, blockHeader.number.toBigInt()),
      handleExtension(blockHeader)
    ])
    await blockRecord.save()
  } catch (err) {
    logger.error('record block error:' + block.block.header.number.toNumber());
    logger.error('record block error detail:' + err);
  }
}

export function handleCall(
  idx: string,
  extrinsic: Omit<SubstrateExtrinsic, 'events' | 'success'>,
  extraDetails: {
    nbEvents: number;
    success?: boolean | undefined;
    fee?: string | undefined;
    feeRounded?: number | undefined;
  } | undefined
): Extrinsic {
  try {
    const block = extrinsic.block as CorrectSubstrateBlock
    const ext = extrinsic.extrinsic
    const methodData = ext.method
    const key = `${methodData.section}_${methodData.method}`
    const argsValue = key === "dataAvailability_submitData" ?
      // We handle the block differently
      methodData.args.map((a, i) => i === 0 ? handleDaSubmission(a) : a.toString())
      :
      key === "vector_execute" ?
        // We handle the parameter of index 1 of vector execute differently
        methodData.args.map((a, i) => i === 1 ? handleVectorExecuteMessage(a) : a.toString())
        : key === "vector_sendMessage" ?
          // We handle the parameter of index 0 of vector send message differently
          methodData.args.map((a, i) => i === 0 ? handleVectorSendMessage(a) : a.toString())
          :
          methodData.args.map((a) => a.toString())

    const extrinsicRecord = new Extrinsic(
      idx,
      block.block.header.number.toString(),
      ext.hash.toString(),
      methodData.section,
      methodData.method,
      block.block.header.number.toBigInt(),
      extraDetails?.success || false,
      ext.isSigned,
      extrinsic.idx,
      ext.hash.toString(),
      block.timestamp,
      // descriptionRecord.id,
      ext.signer.toString(),
      ext.signature.toString(),
      ext.nonce.toNumber(),
      methodData.meta.args.map(a => a.name.toString()),
      argsValue,
      extraDetails?.nbEvents || 0
    );
    extrinsicRecord.fees = extraDetails?.fee ? extraDetails?.fee : "0"
    extrinsicRecord.feesRounded = extraDetails?.feeRounded ? extraDetails?.feeRounded : 0
    return extrinsicRecord
  } catch (err: any) {
    logger.error(`record extrinsic error at : hash(${extrinsic.extrinsic.hash}) and block nb ${extrinsic.block.block.header.number.toNumber()}`);
    logger.error('record extrinsic error detail:' + err);
    if (err.sql) logger.error('record extrinsic error sql detail:' + err.sql);
    throw err
  }
}

export function handleEvent(blockNumber: string, eventIdx: number, event: EventRecord, extrinsicId: number, timestamp: Date): Event {
  try {
    const eventData = event.event
    const argsValue = `${eventData.section}_${eventData.method}` === "dataAvailability_DataSubmitted" ?
      eventData.data.map((a, i) => i === 1 ? a.toString().slice(0, 64) : a.toString())
      :
      eventData.data.map((a) => a.toString())

    const newEvent = new Event(
      `${blockNumber}-${eventIdx}`,
      blockNumber,
      eventData.section,
      eventData.method,
      BigInt(blockNumber),
      eventIdx,
      eventData.method,
      // descriptionRecord.id,
      eventData.meta.args.map(a => a.toString()),
      argsValue,
      timestamp
    );
    if (extrinsicId !== -1) newEvent.extrinsicId = `${blockNumber}-${extrinsicId}`
    return newEvent;
  } catch (err) {
    logger.error('record event error at block number:' + blockNumber.toString());
    logger.error('record event error detail:' + err);
    throw err
  }
}

export function handleDataSubmission(
  idx: string,
  extrinsic: Omit<SubstrateExtrinsic, 'events' | 'success'>,
  extraDetails: {
    nbEvents: number;
    success?: boolean | undefined;
    fee?: string | undefined;
    feeRounded?: number | undefined;
  } | undefined
): DataSubmission {
  const block = extrinsic.block as CorrectSubstrateBlock
  const ext = extrinsic.extrinsic
  const methodData = ext.method

  let dataSubmissionSize = methodData.args.length > 0 ? methodData.args[0].toString().length / 2 : 0
  const formattedInspect = formatInspect(ext.inspect())
  const appIdInspect = formattedInspect.find(x => x.name === "appId")
  const appId = appIdInspect ? Number(appIdInspect.value) : 0
  const dataSubmissionRecord = new DataSubmission(
    idx,
    idx,
    block.timestamp,
    dataSubmissionSize,
    appId,
    ext.signer.toString()
  )
  if (extraDetails?.feeRounded) {
    dataSubmissionRecord.fees = extraDetails.feeRounded
    const oneMbInBytes = 1_048_576;
    const feesPerMb = (extraDetails.feeRounded / dataSubmissionSize) * (oneMbInBytes);
    dataSubmissionRecord.feesPerMb = feesPerMb
  }
  return dataSubmissionRecord
}

export const handleLogs = async (blockNumber: string, digest: Digest) => {
  for (const [i, log] of digest.logs.entries()) {
    let engine: string | undefined = undefined
    let data = ""

    if (log.isConsensus) {
      engine = log.asConsensus[0].toString()
      data = log.asConsensus[1].toString()
    }
    else if (log.isSeal) {
      engine = log.asSeal[0].toString()
      data = log.asSeal[1].toString()
    }
    else if (log.isPreRuntime) {
      engine = log.asPreRuntime[0].toString()
      data = log.asPreRuntime[1].toString()
    }
    else if (log.isOther) data = log.asOther.toString()
    else if (log.isAuthoritiesChange) data = log.asAuthoritiesChange.toString()
    else if (log.isChangesTrieRoot) data = log.asAuthoritiesChange.toString()

    await handleLog(blockNumber, i, log.type, engine, data)
  }
}

export const handleLog = async (blockNumber: string, index: number, type: string, engine: string | undefined, data: string) => {
  const logRecord = new Log(
    `${blockNumber}-${index}`,
    blockNumber,
    type,
    data
  )
  if (engine) logRecord.engine = engine
  await logRecord.save()
}

export const updateSession = async (blockRecord: Block, digest: Digest) => {
  try {
    const sessionId = await api.query.session.currentIndex()
    let sessionRecord = await Session.get(sessionId.toString())
    if (!sessionRecord) {
      const validators = (await api.query.session.validators()) as unknown as string[]
      sessionRecord = new Session(sessionId.toString(), validators.map(x => x.toString()))
      await sessionRecord.save()
      await setAccountsAsValidators(validators)
    }
    blockRecord.sessionId = Number(sessionRecord.id)
    const author = extractAuthor(digest, sessionRecord.validators as unknown as AccountId[])
    blockRecord.author = author ? author.toString() : undefined
  } catch (err) {
    logger.error('update session error');
    logger.error('update session error detail:' + err);
  }
}

export const updateSpecversion = async (specVersion: SpecVersion | null, blockSpecVersion: number, blockNumber: bigint) => {
  if (!specVersion) {
    let dbSpec = await SpecVersion.get(blockSpecVersion.toString());
    if (dbSpec) specVersion = dbSpec
  }
  if (!specVersion || specVersion.id !== blockSpecVersion.toString()) {
    specVersion = new SpecVersion(blockSpecVersion.toString(), blockNumber);
    await specVersion.save();
  }
}

export const handleExtension = async (blockHeader: Header) => {
  const blockNumber = blockHeader.number.toString()
  const blockHeaderUnsafe = blockHeader as any
  if (blockHeaderUnsafe.extension) {
    const extension = JSON.parse(blockHeaderUnsafe.extension)

    // Create extension
    const headerExtensionRecord = new HeaderExtension(
      blockNumber,
      blockNumber
    )
    let data: any = undefined
    if (extension.v1 !== undefined) {
      headerExtensionRecord.version = "v1"
      data = extension.v1
    }
    if (extension.v2 !== undefined) {
      headerExtensionRecord.version = "v2"
      data = extension.v2
    }
    if (extension.v3 !== undefined) {
      headerExtensionRecord.version = "v3"
      data = extension.v3
    }
    await headerExtensionRecord.save()

    // Create commitment
    const commitmentRecord = new Commitment(
      blockNumber,
      blockNumber,
      headerExtensionRecord.id
    )
    commitmentRecord.rows = data.commitment.rows
    commitmentRecord.cols = data.commitment.cols
    commitmentRecord.dataRoot = data.commitment.dataRoot
    commitmentRecord.commitment = data.commitment.commitment
    await commitmentRecord.save()

    // Create app lookup
    const appLookupRecord = new AppLookup(
      blockNumber,
      blockNumber,
      headerExtensionRecord.id
    )
    appLookupRecord.size = data.appLookup.size
    appLookupRecord.index = JSON.stringify(data.appLookup.index)
    await appLookupRecord.save()
  }
}

export const setAccountsAsValidators = async (accounts: string[]) => {
  const accountsInDb: AccountEntity[] = await store.getByFields(
    "AccountEntity",
    [["id", "in", accounts]],
    { limit: 100 }
  );
  const accountsToSave = accountsInDb.map(x => {
    x.validator = true
    x.validatorSessionParticipated = (x.validatorSessionParticipated || 0) + 1
    return x
  })
  await store.bulkUpdate('AccountEntity', accountsToSave)
}
