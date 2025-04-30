import { EventRecord } from "@polkadot/types/interfaces"
import { Balance } from "@polkadot/types/interfaces"
import { roundPrice } from ".";
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
        const accountsInDb: AccountEntity[] = await store.getByFields(
            "AccountEntity",
            [["id", "in", addresses]],
            { limit: 100 }
          );
        const accountsToCreate: AccountEntity[] = []
        const accountsToUpdate: AccountEntity[] = []
        const res = await api.query.system.account.multi(addresses) as any
        res.map(({ data: balance }: { data: AccountData }, idx: number) => {
            if (balance) {
                let isNew = false
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
                let record = accountsInDb.find(x => x.id === address)
                if (!record) {
                    record = new AccountEntity(address, date, date, timestamp)
                    isNew = true
                }
                record.amount = amount
                record.amountFrozen = amountFrozen
                record.amountTotal = amountTotal
                record.amountRounded = roundPrice(record.amount)
                record.amountFrozenRounded = roundPrice(record.amountFrozen)
                record.amountTotalRounded = roundPrice(record.amountTotal)
                record.updatedAt = date
                if (isNew) {
                    accountsToCreate.push(record)
                } else {
                    accountsToUpdate.push(record)
                }
            } else {
                logger.warning("Error in update account : Balance not found")
            }
        })
        return {
            accountsToCreate,
            accountsToUpdate
        }
    } catch (err: any) {
        logger.error("Error in update account : " + err.toString())
        if (err.sql) logger.error("Error in update account : " + JSON.stringify(err.sql))
        return {
            accountsToCreate: [],
            accountsToUpdate: []
        }
    }
}

export const transferHandler = (event: EventRecord, blockId: string, blockHash: string, timestamp: Date, extrinsicIndex: string, eventIndex: number) => {
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
    return record
}