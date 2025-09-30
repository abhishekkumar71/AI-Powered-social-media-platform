// pages/_app.tsx
import * as React from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { SessionProvider } from "next-auth/react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import NotificationProvider from "@/lib/providers/NotificationProvider";
import LoadingProvider from "@/lib/providers/LoadingProvider";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
  },
  typography: { fontFamily: ["Inter", "Poppins", "Arial"].join(",") },
});

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Head>
          <title>PostPilot</title>
          <meta name="description" content="PostPilot - AI-powered social media scheduling platform" />
        </Head>
        <NotificationProvider>
          <LoadingProvider>
            <Component {...pageProps} />
          </LoadingProvider>
        </NotificationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
