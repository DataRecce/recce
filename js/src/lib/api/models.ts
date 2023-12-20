import { axiosClient } from "./axiosClient";

export async function fetchModelRowCount(modelName: string) {
  const response = await axiosClient.get(`/api/models/${modelName}/row_count`);
  return response.data;
}
