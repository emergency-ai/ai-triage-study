import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import { Provider } from "@/components/ui/provider";

export const metadata: Metadata = {
  title: "AI Triage Study — SARA",
  description: "Validate patient profile generation accuracy for SARA ambient agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0 }} suppressHydrationWarning>
        <Provider defaultTheme="dark">
          <AppProviders>{children}</AppProviders>
        </Provider>
      </body>
    </html>
  );
}
