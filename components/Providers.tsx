'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ThemeProvider } from './ThemeProvider';
import QueryProvider from './QueryProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
          config={{
            appearance: {
              theme: 'dark',
              accentColor: '#ee3e3d',
            },
            embeddedWallets: {
              ethereum: {
                createOnLogin: 'users-without-wallets',
              },
            },
          }}
        >
          {children}
        </PrivyProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
