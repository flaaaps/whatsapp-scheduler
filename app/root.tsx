import {
   Links,
   Meta,
   Outlet,
   Scripts,
   ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import styles from "./styles/global.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export default function App() {
   return (
      <html lang="en">
         <head>
            <title>WhatsApp Message Scheduler</title>
            <meta charSet="utf-8" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
            <Meta />
            <Links />
         </head>
         <body className="min-h-screen bg-background text-foreground antialiased">
            <Outlet />
            <ScrollRestoration />
            <Scripts />
         </body>
      </html>
   );
}
