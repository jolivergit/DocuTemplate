import { QueryClient, QueryFunction } from "@tanstack/react-query";

let activeWorkspaceId: string | null = null;

export function getActiveWorkspaceId() {
  return activeWorkspaceId;
}

export function setActiveWorkspaceId(id: string | null) {
  activeWorkspaceId = id;
}

function workspaceHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  if (activeWorkspaceId) result.set("X-Workspace-Id", activeWorkspaceId);
  else result.delete("X-Workspace-Id");
  return result;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    let code: string | undefined;
    try {
      const body = JSON.parse(text);
      if (typeof body.error === "string") message = body.error;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // Some infrastructure errors have a plain-text response.
    }
    throw new ApiError(message, res.status, code);
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const headers = workspaceHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  if (headers.get("X-Workspace-Id") !== activeWorkspaceId) {
    throw new ApiError("The workspace changed while this request was running. Please try again.", 409, "WORKSPACE_CHANGED");
  }
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: workspaceHeaders(),
      credentials: "include",
      signal,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
