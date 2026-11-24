# @arcanetech/privacy-sdk-blend

Place one Interest Deposit from private notes into a whitelisted Blend reserve, and return it to a private address.

Derive the G address from the spend scalar, the Blend pool, the token, and the chain index. `placementTransaction` signs the public signals with `stateRoot` zeroed and signs the ciphertext. Leave the proof bytes out of that signature. The public-withdrawal relay package pays that account, and the adapter `deposit` call carries the proof. Record the Interest Deposit as the chain index, the G address, the Blend pool, and the reserve. Read the share balance from the Adapter and convert it to underlying with the Blend exchange rate.

`returnTransaction` accepts a list. Each G signs that same list and the same normalized signals. The envelope source is the relay. A zero record stays recorded, so the next placement takes a new chain index.

`restoreInterestDeposits` walks every spend scalar, Blend pool, and token. For each chain it derives index 0, then 1, then 2, and reads `recorded` and `shares` from the Adapter. A zero share balance stays in the list. The walk stops at the first index with no Adapter record. The underlying comes from those shares and the Blend exchange rate. The contract does not store the chain index.
