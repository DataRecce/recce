import {
  type ApiClient,
  type ApiResponse,
  createFetchClient,
} from "../fetchClient";

export interface User {
  id: string;
  login: string;
  login_type: string;
  email: string;
  onboarding_state: string;
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
}

const defaultClient = createFetchClient({ baseURL: "" });
const githubClient = createFetchClient({ baseURL: "https://api.github.com" });

export async function fetchUser(
  client: ApiClient = defaultClient,
): Promise<User> {
  try {
    const response = await client.get<never, ApiResponse<User>>("/api/users");
    return response.data;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Error fetching user data:", error);
    }
    throw error;
  }
}

export async function fetchGitHubAvatar(
  userId: string,
): Promise<string | null> {
  try {
    const response = await githubClient.get<never, ApiResponse<GitHubUser>>(
      `/user/${userId}`,
    );
    return response.data.avatar_url;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Failed to fetch GitHub avatar:", error);
    }
    return null;
  }
}
