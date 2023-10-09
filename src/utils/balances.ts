import { EventRecord } from "@polkadot/types/interfaces"
import { AccountInfo, Balance } from "@polkadot/types/interfaces"
import { roundPrice } from ".";
import { AccountEntity, TransferEntity } from "../types";

export const updateAccounts = async (addresses: string[]) => {
    try {
        const res = await api.query.system.account.multi(addresses) as unknown as AccountInfo[]
        await Promise.all(
            res.map(async ({ data: balance }, idx) => {
                if (balance) {
                    const { feeFrozen, free, miscFrozen, reserved } = balance
                    const address = addresses[idx]
                    const date = new Date()
                    const balanceFrozenMisc = miscFrozen.toBigInt()
                    const balanceFrozenFee = feeFrozen.toBigInt()
                    const balanceFrozen = balanceFrozenFee > balanceFrozenMisc ? balanceFrozenFee : balanceFrozenMisc
                    const balanceReserved = reserved.toBigInt()
                    const balanceFree = free.toBigInt()
                    const amountFrozen = balanceFrozen.toString()
                    const amountTotal = (balanceFree + balanceReserved).toString()
                    const amount = (balanceFree - balanceFrozen).toString()
                    let record = await AccountEntity.get(address)
                    if (record === undefined) {
                        record = new AccountEntity(address, date, date)
                    }
                    record.amount = amount
                    record.amountFrozen = amountFrozen
                    record.amountTotal = amountTotal
                    record.amountRounded = roundPrice(record.amount)
                    record.amountFrozenRounded = roundPrice(record.amountFrozen)
                    record.amountTotalRounded = roundPrice(record.amountTotal)
                    record.updatedAt = date
                    await record.save()
                } else {
                    logger.error("Error in update accout : Balance not found")
                }
            }),
        )
    } catch (err: any) {
        logger.error("Error in update accout : " + err.toString())
        if (err.sql) logger.error("Error in update accout : " + JSON.stringify(err.sql))
    }
}

export const transferHandler = async (event: EventRecord, blockId: string, blockHash: string, timestamp: Date, extrinsicIndex: string) => {
    const [from, to, amount] = event.event.data
    const formattedAmount = !(typeof amount === "string") ? (amount as Balance).toBigInt().toString() : amount
    const record = new TransferEntity(
        `${blockId}-${event.event.index}`,
        blockId,
        blockHash,
        extrinsicIndex,
        timestamp,
        from.toString(),
        to.toString(),
        "AVL",
        formattedAmount,
        roundPrice(formattedAmount)
    )
    await record.save()
    await updateAccounts([to.toString()])
}