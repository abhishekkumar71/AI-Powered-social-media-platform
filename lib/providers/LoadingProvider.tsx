// lib/providers/LoadingProvider.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";
import { Backdrop, CircularProgress } from "@mui/material";

const LoadingContext = createContext({
  setLoading: (v: boolean) => {},
});

export function useLoading() {
  return useContext(LoadingContext);
}

export default function LoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoadingState] = useState(false);
  const setLoading = (v: boolean) => setLoadingState(v);

  return (
    <LoadingContext.Provider value={{ setLoading }}>
      {children}
      <Backdrop sx={{ color: "#fff", zIndex: 1300 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </LoadingContext.Provider>
  );
}
