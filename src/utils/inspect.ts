import type { Inspect } from '@polkadot/types/types';
import { u8aToHex } from '@polkadot/util';

interface Inspected {
    name: string;
    value: string;
}

export const splitStringIntoArray = (inputString: string, chunkSize: number = 2): string[] => {
    const result: string[] = []

    for (let i = 0; i < inputString.length; i += chunkSize) {
        result.push(inputString.substring(i, i + chunkSize))
    }

    return result
}

export const decodeU8IntAppId = (value: Uint8Array): string => {
    const hexAppId = u8aToHex(value, undefined, false)
    return decodeHexAppId(hexAppId)
}

export const decodeHexAppId = (value: `0x${string}`): string => {
    if (value.length <= 1 || value.length % 2 !== 0) throw new Error("Invalid length")
    const v = value.startsWith("0x") ? value.substring(2) : value
    const array = splitStringIntoArray(v)
    let s = BigInt(0)
    array.forEach((x, i) => {
        s += BigInt(parseInt(x, 16)) << BigInt(i * 8)
    })
    const result = (s >> BigInt(array.length <= 4 ? 2 : 8)).toString()
    return result
}


export function formatInspect({ inner = [], name = '', outer = [] }: Inspect, result: Inspected[] = []): Inspected[] {
    if (outer.length) {
        const value = new Array<string>(outer.length);

        for (let i = 0; i < outer.length; i++) {
            if (name !== 'appId') {
                value[i] = u8aToHex(outer[i], undefined, false);
            } else {
                value[i] = decodeU8IntAppId(outer[i]);
            }
        }

        result.push({ name, value: value.join(' ') });
    }

    for (let i = 0; i < inner.length; i++) {
        formatInspect(inner[i], result);
    }

    return result;
}