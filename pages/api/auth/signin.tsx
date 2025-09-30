// pages/auth/signin.tsx
import { getProviders, signIn } from "next-auth/react";
import { Box, Button, Typography, Paper, Stack } from "@mui/material";
import Image from "next/image";

export default function SignIn({ providers }: any) {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
      p={2}
    >
      <Paper sx={{ p: { xs: 3, md: 6 }, maxWidth: 400, width: "100%", textAlign: "center" }} elevation={4}>
        <Box mb={3}>
          <Image src="/logo.png" alt="PostPilot Logo" width={80} height={80} />
        </Box>
        <Typography variant="h5" gutterBottom>
          Sign in to PostPilot
        </Typography>
        <Stack spacing={2} mt={3}>
          {providers &&
            Object.values(providers).map((provider: any) => (
              <Button
                key={provider.name}
                variant="contained"
                color="primary"
                onClick={() => signIn(provider.id)}
              >
                Sign in with {provider.name}
              </Button>
            ))}
        </Stack>
      </Paper>
    </Box>
  );
}

export async function getServerSideProps() {
  const providers = await getProviders();
  return { props: { providers } };
}
