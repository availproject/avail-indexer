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

export const isNumeric = (str: string) => {
	if (typeof str != "string") return false
	return !isNaN(str as unknown as number) && !isNaN(parseFloat(str))
}

export const roundPrice = (amount : string) => {
	try{
		if (!amount || amount.length === 0 || !isNumeric(amount)) throw new Error()
		const divider = 1000000000000000000
		const parsedPrice = (parseInt(amount)/divider).toFixed(3)
	    const roundedPrice = (parseFloat(parsedPrice)*100)/100;
		return roundedPrice
	}catch{
		return undefined
	}
}