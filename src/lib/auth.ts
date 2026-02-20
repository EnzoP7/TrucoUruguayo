import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      googleId?: string;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Confiar en el host en producción (necesario para Render, Vercel, etc.)
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // En el primer login, guardar el googleId en el token
      if (account && profile) {
        token.googleId = profile.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // Pasar googleId a la sesión del cliente
      if (session.user) {
        session.user.googleId = token.googleId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
