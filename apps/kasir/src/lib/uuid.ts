import * as Crypto from "expo-crypto";

/** UUID v4 dibuat di HP: jadi kunci idempotency order dan pembayaran. */
export const uuid = (): string => Crypto.randomUUID();
