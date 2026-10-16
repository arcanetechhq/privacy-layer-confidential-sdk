const COMPLETIONS_PATH = 'authorization-completions';
const CHALLENGES_PATH = 'authorization-challenges';
const RECORDS_PATH = 'records';

export const PRIVATE_DATA_PATH = {
  completions: COMPLETIONS_PATH,
  challenges: CHALLENGES_PATH,
  records: RECORDS_PATH,
} as const;

function resolveFetch(
  fetchImpl: typeof globalThis.fetch | undefined,
): typeof globalThis.fetch {
  return fetchImpl ?? globalThis.fetch.bind(globalThis);
}

function joinPrivateDataUrl(origin: string, path: string): string {
  const base = origin.trim().replace(/\/$/u, '');
  if (!base) {
    throw new Error('Private data origin is not configured.');
  }
  return `${base}/${path}`;
}

export async function postPrivateData(input: {
  origin: string;
  path: string;
  body: unknown;
  fetchImpl: typeof globalThis.fetch | undefined;
}): Promise<unknown> {
  const response = await resolveFetch(input.fetchImpl)(
    joinPrivateDataUrl(input.origin, input.path),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.body),
    },
  );
  if (!response.ok) {
    throw new Error(`Private data request failed (${response.status}).`);
  }
  return response.json();
}
