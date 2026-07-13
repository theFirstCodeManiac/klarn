export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Klarn</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      // Automatically and instantly redirect back to home to recover from SSR crashes
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    </script>
  </head>
  <body>
  </body>
</html>`;
}

