import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/logo.png" />
        <meta name="description" content="AI-powered social media scheduler." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
