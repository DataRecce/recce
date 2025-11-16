import axios, { AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

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

export async function fetchUser(): Promise<User> {
  try {
    const response = await axiosClient.get<never, AxiosResponse<User>>(
      "/api/users",
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

export async function fetchGitHubAvatar(
  userId: string,
): Promise<string | null> {
  try {
    const response = await axios.get<GitHubUser>(
      `https://api.github.com/user/${userId}`,
    );
    return response.data.avatar_url;
  } catch (error) {
    console.warn("Failed to fetch GitHub avatar:", error);
    return null;
  }
}
