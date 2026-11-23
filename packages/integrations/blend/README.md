# @arcanetech/privacy-sdk-blend

Place one Interest Deposit from private notes into a whitelisted Blend reserve.

Derive the G address from the spend scalar, the Blend pool, the token, and the chain index. Sign the public signals with `stateRoot` zeroed and sign the ciphertext. Leave the proof bytes out of that signature. Record the Interest Deposit as the chain index, the G address, the Blend pool, and the reserve. Read the share balance from the Adapter and convert it to underlying with the Blend exchange rate.
