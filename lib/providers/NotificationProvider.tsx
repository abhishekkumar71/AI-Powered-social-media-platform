import React, { createContext, useContext, useState, ReactNode } from "react";
import { Snackbar, Alert } from "@mui/material";

type NotificationOptions = { message: string; severity?: "success" | "error" | "info" | "warning"; duration?: number };

const NotificationContext = createContext({
  notify: (opts: NotificationOptions) => {},
});

export function useNotification() {
  return useContext(NotificationContext);
}

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<NotificationOptions>({ message: "", severity: "info", duration: 4000 });

  const notify = (o: NotificationOptions) => {
    setOpts({ severity: o.severity ?? "info", message: o.message, duration: o.duration ?? 4000 });
    setOpen(true);
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={opts.duration}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setOpen(false)} severity={opts.severity} sx={{ width: "100%" }}>
          {opts.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}
