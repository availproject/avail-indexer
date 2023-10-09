import { SubstrateExtrinsic } from "@subql/types"

export const getFees = async (extObjectHash: string, blockHash: string) => {
    try{
        let fees = await api.rpc.payment.queryFeeDetails(extObjectHash, blockHash)
        if (fees){
            const feesFormatted = JSON.parse(JSON.stringify(fees))
            const inclusionFee = feesFormatted.inclusionFee || undefined
            if (inclusionFee){
                const baseFee = inclusionFee.baseFee || undefined
                const lenFee = inclusionFee.lenFee || undefined
                const adjustedWeightFee = inclusionFee.adjustedWeightFee || undefined
                let totalFees = BigInt(0)
                if(baseFee) totalFees = totalFees + BigInt(baseFee)
                if(lenFee) totalFees = totalFees + BigInt(lenFee)
                if(adjustedWeightFee) totalFees = totalFees + BigInt(adjustedWeightFee)
                return totalFees.toString()
            }
        }
        return ""
    }catch(err){
        logger.error(`get extrinsic fee error`);
        logger.error('get extrinsic fee error detail:' + err);
    }
}

export const checkIfExtrinsicExecuteSuccess = (extrinsic: SubstrateExtrinsic): boolean => {
    const { events } = extrinsic
  
    return !events.find((item) => {
      const { event: { method, section }} = item
  
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