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