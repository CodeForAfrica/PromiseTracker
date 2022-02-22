import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import actnow from "@/promisetracker/lib/actnow";

const options = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      async authorize(credentials) {
        const authBody = {
          username: credentials.email,
          password: credentials.password,
        };
        const user = await actnow().accounts().login(authBody);
        if (user.error) {
          throw new Error(user.error);
        }
        user.accessToken = user.access_token;
        user.refreshToken = user.refresh_token;
        return user;
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ user, account, token }) {
      if (account && user) {
        if (account.provider === "credentials") {
          return {
            accountType: "credentials",
            ...user,
          };
        }
      }
      if (token) {
        return token;
      }
      return { ...account, ...user };
    },
    async session({ session, token }) {
      if (!(session && token)) {
        return null;
      }
      return { ...session, ...token };
    },
  },

  pages: {
    signIn: "/login",
    error: "/act-now", // Error code passed in query string as ?error=
  },
};

export default NextAuth(options);
