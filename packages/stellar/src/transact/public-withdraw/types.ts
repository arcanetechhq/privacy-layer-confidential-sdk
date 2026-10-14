export interface StellarPublicOutputNoteFields {
  value: string;
  secret: string;
  nullifier: string;
  ownerPubX: string;
  ownerPubY: string;
  ownerMode: string;
  assetHi: string;
  assetLo: string;
  applicationId: string;
}

export interface StellarPublicOutputSubmission {
  leafIndex: number;
  to: string;
  note: StellarPublicOutputNoteFields;
}
