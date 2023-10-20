import type { Inspect } from '@polkadot/types/types';
import { u8aToHex } from '@polkadot/util';

interface Inspected {
    name: string;
    value: string;
}

export function formatInspect({ inner = [], name = '', outer = [] }: Inspect, result: Inspected[] = []): Inspected[] {
    if (outer.length) {
        const value = new Array<string>(outer.length);

        for (let i = 0; i < outer.length; i++) {
            if (name !== 'appId') {
                value[i] = u8aToHex(outer[i], undefined, false);
            } else {
                const hexAppId = u8aToHex(outer[i], undefined, false);
                const appId = parseInt(hexAppId, 16) >> 2;

                value[i] = appId.toString();
            }
        }

        result.push({ name, value: value.join(' ') });
    }

    for (let i = 0; i < inner.length; i++) {
        formatInspect(inner[i], result);
    }

    return result;
}