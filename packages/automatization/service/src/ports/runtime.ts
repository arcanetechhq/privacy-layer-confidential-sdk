export interface Clock {
  now(): Promise<bigint>;
}

export interface FreshScalars {
  next(): Promise<string>;
}
