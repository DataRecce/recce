import { PUBLIC_API_URL } from "@datarecce/ui/lib/const";
import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

export const axiosClient = axios.create({
  baseURL: PUBLIC_API_URL,
});

export const reactQueryClient = new QueryClient();
