import type { AddressInfo } from "net";
import type { Server } from "http";
import { createApp } from "../../src/app";

export interface TestServer {
  baseUrl: string;
  server: Server;
  close: () => Promise<void>;
}

export const startTestServer = async (): Promise<TestServer> => {
  const app = createApp();

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export const api = async <T = any>(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body, headers: response.headers };
};

export const rawPost = async (
  baseUrl: string,
  path: string,
  rawBody: string,
  headers: Record<string, string> = {}
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body, headers: response.headers };
};
