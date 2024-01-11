import { EventRecord } from "@polkadot/types/interfaces"
import { Balance } from "@polkadot/types/interfaces"
import { roundPrice } from ".";
import { transferEvents } from "../mappings/mappingHandlers";
import { AccountEntity, TransferEntity } from "../types";

type AccountData = {
    free: Balance;
    reserved: Balance;
    frozen: Balance;
    miscFrozen: Balance; // Old structure
    feeFrozen: Balance; // Old structure
}

export const updateAccounts = async (addresses: string[], timestamp: Date) => {
    try {
        const res = await api.query.system.account.multi(addresses) as any
        await Promise.all(
            res.map(async ({ data: balance }: { data: AccountData }, idx: number) => {
                if (balance) {
                    const { feeFrozen, free, miscFrozen, reserved, frozen } = balance
                    const address = addresses[idx]
                    const date = new Date()

                    let balanceFrozen: bigint | undefined = undefined
                    if (frozen) {
                        balanceFrozen = frozen.toBigInt()
                    } else {
                        if (miscFrozen && feeFrozen) {
                            const balanceFrozenMisc = miscFrozen.toBigInt()
                            const balanceFrozenFee = feeFrozen.toBigInt()
                            balanceFrozen = balanceFrozenFee > balanceFrozenMisc ? balanceFrozenFee : balanceFrozenMisc
                        } else if (miscFrozen) {
                            balanceFrozen = miscFrozen.toBigInt()
                        } else if (feeFrozen) {
                            balanceFrozen = feeFrozen.toBigInt()
                        }
                    }

                    const balanceReserved = reserved.toBigInt()
                    const balanceFree = free.toBigInt()
                    const amountFrozen = balanceFrozen ? balanceFrozen.toString() : "0"
                    const amountTotal = (balanceFree + balanceReserved).toString()
                    const amount = balanceFrozen ? (balanceFree - balanceFrozen).toString() : balanceFree.toString()
                    let record = await AccountEntity.get(address)
                    if (record === undefined) {
                        record = new AccountEntity(address, date, date, timestamp)
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
                    logger.warning("Error in update accout : Balance not found")
                }
            }),
        )
    } catch (err: any) {
        logger.error("Error in update accout : " + err.toString())
        if (err.sql) logger.error("Error in update accout : " + JSON.stringify(err.sql))
    }
}

export const transferHandler = async (event: EventRecord, blockId: string, blockHash: string, timestamp: Date, extrinsicIndex: string, eventIndex: number) => {
    const key = `${event.event.section}.${event.event.method}`
    if (transferEvents.includes(key)) {
        const [from, to, amount] = event.event.data
        const formattedAmount = !(typeof amount === "string") ? (amount as Balance).toBigInt().toString() : amount
        const record = new TransferEntity(
            `${blockId}-${eventIndex}`,
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
        await updateAccounts([to.toString()], timestamp)
    }
}