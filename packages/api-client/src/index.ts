export type XtiitchApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
};

export class XtiitchApiClient {
  constructor(private readonly options: XtiitchApiClientOptions) {}

  async health(): Promise<{ status: string }> {
    const response = await fetch(new URL("/healthz", this.options.baseUrl));
    if (!response.ok) {
      throw new Error(`Xtiitch API health check failed: ${response.status}`);
    }

    return response.json() as Promise<{ status: string }>;
  }
}

