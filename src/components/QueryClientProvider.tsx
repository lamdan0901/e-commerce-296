"use client";

import {
  QueryClient,
  QueryClientProvider as Provider,
} from "@tanstack/react-query";
import { ReactNode } from "react";

const client = new QueryClient();

export function QueryClientProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <Provider client={client}>{children}</Provider>;
}
