// components/Features.tsx
import React from "react";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BoltIcon from "@mui/icons-material/Bolt";
import ScheduleIcon from "@mui/icons-material/Schedule";

const features = [
  { Icon: AutoAwesomeIcon, title: "AI-generated content", desc: "Write captions and posts instantly" },
  { Icon: BoltIcon, title: "One-click posting", desc: "Post to X/Instagram/LinkedIn" },
  { Icon: ScheduleIcon, title: "Schedule & automate", desc: "Plan ahead and post automatically" },
];

export default function Features() {
  return (
    <section id="features" style={{ padding: "3rem 1rem" }}>
      <Box sx={{ maxWidth: 1100, margin: "0 auto" }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, textAlign: "center" }}>Features</Typography>
        <Grid container spacing={3} sx={{justifyContent:"space-around"}}>
          {features.map((f, i) => (
            <Grid  xs={12} sm={6} md={4} key={i}  component={React.Fragment as any}>
              <Paper sx={{ p: 3, height: "100%", display: "flex", gap: 2, alignItems: "center" }} elevation={2}>
                <f.Icon sx={{ fontSize: 40, color: "#1976d2" }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{f.title}</Typography>
                  <Typography color="text.secondary">{f.desc}</Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    </section>
  );
}
