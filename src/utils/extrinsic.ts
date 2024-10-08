import { BN } from 'bn.js';
import { Codec } from '@polkadot/types/types'
import { SubstrateExtrinsic } from "@subql/types"
import { roundPrice } from "."

export const getFees = async (extObjectHash: string, blockHash: string) => {
    try {
        let fees = await api.rpc.payment.queryFeeDetails(extObjectHash, blockHash)
        if (fees) {
            const feesFormatted = JSON.parse(JSON.stringify(fees))
            const inclusionFee = feesFormatted.inclusionFee || undefined
            if (inclusionFee) {
                const baseFee = inclusionFee.baseFee || undefined
                const lenFee = inclusionFee.lenFee || undefined
                const adjustedWeightFee = inclusionFee.adjustedWeightFee || undefined
                let totalFees = BigInt(0)
                if (baseFee) totalFees = totalFees + BigInt(baseFee)
                if (lenFee) totalFees = totalFees + BigInt(lenFee)
                if (adjustedWeightFee) totalFees = totalFees + BigInt(adjustedWeightFee)
                return totalFees.toString()
            }
        }
        return ""
    } catch (err) {
        logger.error(`get extrinsic fee error`);
        logger.error('get extrinsic fee error detail:' + err);
    }
}


export const getFeesFromEvent = (params: any[]) => {
    try {
        const fee = params[1]
        const tip = params[2]
        const total = (Number(fee) + Number(tip)).toString()
        return { fee: total, feeRounded: roundPrice(total) }
    } catch (err) {
        logger.error(`get extrinsic fee from event error`);
        logger.error('get extrinsic fee from event error detail:' + err);
        return { fee: "0", feeRounded: 0 }
    }
}

export const checkIfExtrinsicExecuteSuccess = (extrinsic: SubstrateExtrinsic): boolean => {
    const { events } = extrinsic

    return !events.find((item) => {
        const { event: { method, section } } = item

        return method === 'ExtrinsicFailed' && section === 'system'
    })
}

export const shouldGetFees = (module: string): boolean => {
    const ignoreModules = [
        'timestamp',
        'authorship'
    ]
    return !ignoreModules.includes(module)
}

export const handleDaSubmission = (data: Codec) => {
    return data.toString().slice(0, 64)
}

export const handleVectorExecuteMessage = (message: Codec) => {
    let newArg: { message: { fungibleToken?: { assetId: `0x${string}`, amount: number | `0x${string}` } } } = message.toJSON() as any
    if (newArg.message.fungibleToken && !newArg.message.fungibleToken.amount.toString().startsWith('0x')) {
        newArg.message.fungibleToken.amount = `0x${new BN(newArg.message.fungibleToken.amount.toString()).toString('hex')}`
        return JSON.stringify(newArg)
    } else {
        return message.toString()
    }
}

export const handleVectorSendMessage = (message: Codec) => {
    let newArg: { fungibleToken?: { assetId: `0x${string}`, amount: number | `0x${string}` } } = message.toJSON() as any
    if (newArg.fungibleToken && !newArg.fungibleToken.amount.toString().startsWith('0x')) {
        newArg.fungibleToken.amount = `0x${new BN(newArg.fungibleToken.amount.toString()).toString('hex')}`
        return JSON.stringify(newArg)
    } else {
        return message.toString()
    }
}
