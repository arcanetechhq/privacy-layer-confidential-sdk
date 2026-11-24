# @arcanetech/privacy-sdk-blend

Place one Interest Deposit from private notes into a whitelisted Blend reserve, and return it to a private address.

Derive the G address from the spend scalar, the Blend pool, the token, and the chain index. `placementTransaction` signs the public signals with `stateRoot` zeroed and signs the ciphertext. Leave the proof bytes out of that signature. The public-withdrawal relay package pays that account, and the adapter `deposit` call carries the proof. Record the Interest Deposit as the chain index, the G address, the Blend pool, and the reserve. Read the share balance from the Adapter and convert it to underlying with the Blend exchange rate.

`returnTransaction` accepts a list. Each G signs that same list and the same normalized signals. The envelope source is the relay. A zero record stays recorded, so the next placement takes a new chain index.
