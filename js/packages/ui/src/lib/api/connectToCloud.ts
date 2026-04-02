import { PUBLIC_API_URL } from "../const";
import {
  type ApiClient,
  type ApiResponse,
  createFetchClient,
} from "../fetchClient";

export interface ConnectToCloud {
  connection_url: string;
}

const defaultApiClient = createFetchClient({ baseURL: PUBLIC_API_URL ?? "" });

export async function connectToCloud(
  client: ApiClient = defaultApiClient,
): Promise<ConnectToCloud> {
  const response = await client.post<unknown, ApiResponse<ConnectToCloud>>(
    "/api/connect",
  );
  return response.data;
}
