import {EventRecord} from "@polkadot/types/interfaces"
import { SubstrateBlock, SubstrateExtrinsic } from "@subql/types";

function filterExtrinsicEvents(
    extrinsicIdx: number,
    events: EventRecord[],
): EventRecord[] {
    return events.filter(
        ({ phase }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eqn(extrinsicIdx),
    );
}

export function wrapExtrinsics(
    wrappedBlock: SubstrateBlock,
): SubstrateExtrinsic[] {
    return wrappedBlock.block.extrinsics.map((extrinsic, idx) => {
        const events = filterExtrinsicEvents(idx, wrappedBlock.events);
        return {
            idx,
            extrinsic,
            block: wrappedBlock,
            events,
            success: getExtrinsicSuccess(events),
        };
    });
}

function getExtrinsicSuccess(events: EventRecord[]): boolean {
    return (
        events.findIndex((evt) => evt.event.method === 'ExtrinsicSuccess') > -1
    );
}

export const isNumeric = (str: string) => {
	if (typeof str != "string") return false
	return !isNaN(str as unknown as number) && !isNaN(parseFloat(str))
}

export const roundPrice = (amount : string) => {
	try{
		if (!amount || amount.length === 0 || !isNumeric(amount)) throw new Error()
		const divider = 1000000000000000000
		const parsedPrice = (parseInt(amount)/divider).toFixed(4)
	    const roundedPrice = (parseFloat(parsedPrice)*1000)/1000;
		return roundedPrice
	}catch{
		return 0
	}
}