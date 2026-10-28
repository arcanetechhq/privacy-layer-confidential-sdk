import { planToJson, restorePlanValue } from './plan-json.js';

function serviceUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(serviceUrl(baseUrl, path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(planToJson(body)),
  });
  return readResponse(response);
}

export async function getJson(baseUrl: string, path: string): Promise<unknown> {
  const response = await fetch(serviceUrl(baseUrl, path));
  if (response.status === 204) {
    return undefined;
  }
  return readResponse(response);
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const parsed: unknown = await response.json();
  return restorePlanValue(parsed);
}
