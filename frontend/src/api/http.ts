import axios from "axios";

export const http = axios.create({
  baseURL: "",
  timeout: 10000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !window.location.pathname.includes("/admin/login")) {
      window.location.href = "/admin/login";
    }
    return Promise.reject(error);
  }
);

export async function unwrap<T>(request: Promise<{ data: { data: T } }>): Promise<T> {
  const response = await request;
  return response.data.data;
}
