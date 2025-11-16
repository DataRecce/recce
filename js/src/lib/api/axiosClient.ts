import { QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { PUBLIC_API_URL } from "@/lib/const";

export const axiosClient = axios.create({
  baseURL: PUBLIC_API_URL,
});

export const reactQueryClient = new QueryClient();
