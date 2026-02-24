import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import { createUser, getUserByGithubId, updateUser } from './db';
import { sql } from '@vercel/postgres';

// Extended user type for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      github_id: number;
      username: string;
      email: string | null;
      avatar_url: string | null;
    };
    accessToken?: string;
  }
}

declare module 'next-auth' {
  interface User {
    github_id?: number;
    accessToken?: string;
    login?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    github_id?: number;
    username?: string;
    email?: string | null;
    avatar_url?: string | null;
    accessToken?: string;
  }
}

// GitHub OAuth scopes needed for the application
const GITHUB_SCOPES = [
  'read:user',      // Read user profile data
  'user:email',     // Read user email addresses
  'repo',           // Full access to public and private repositories
  'star',           // Access to star repositories
].join(' ');

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GITHUB_SCOPES,
        },
      },
    }),
  ],
  callbacks: {
    /**
     * SignIn callback - Create or update user in database
     */
    async signIn({ user, account }) {
      try {
        if (!account?.access_token) {
          console.error('No access token received from GitHub');
          return false;
        }

        const githubId = parseInt(account.providerAccountId, 10);

        if (isNaN(githubId)) {
          console.error('Invalid GitHub ID:', account.providerAccountId);
          return false;
        }

        // Check if user already exists
        const existingUser = await getUserByGithubId(githubId);

        if (existingUser) {
          // Update user information if needed
          await updateUser(existingUser.id, {
            username: user.name || undefined,
            email: user.email || undefined,
            avatar_url: user.image || undefined,
          });

          // Store user ID for later use in session callback
          user.github_id = githubId;
          user.accessToken = account.access_token;
        } else {
          // Create new user
          const newUser = await createUser({
            githubId: githubId,
            username: user.name || user.login || `user_${githubId}`,
            email: user.email || null,
            avatarUrl: user.image || null,
            accessToken: account.access_token,
          });

          user.github_id = githubId;
          user.accessToken = account.access_token;
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },

    /**
     * Session callback - Add custom user data to session
     */
    async session({ session, token }) {
      // Add user data from token to session
      if (token) {
        session.user.id = token.id as string;
        session.user.github_id = token.github_id as number;
        session.user.username = token.username as string;
        session.user.email = token.email as string | null;
        session.user.avatar_url = token.avatar_url as string | null;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },

    /**
     * JWT callback - Store user data in token
     */
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        const githubId = parseInt(account.providerAccountId, 10);

        // Get user from database to get our internal ID
        const dbUser = await getUserByGithubId(githubId);

        if (dbUser) {
          token.id = dbUser.id.toString();
          token.github_id = dbUser.github_id;
          token.username = dbUser.username;
          token.email = dbUser.email;
          token.avatar_url = dbUser.avatar_url;
          token.accessToken = account.access_token;
        }
      }

      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Update user's access token in database
 * @param userId - User ID
 * @param accessToken - New access token
 */
export async function updateUserAccessToken(userId: number, accessToken: string): Promise<void> {
  try {
    await sql`
      UPDATE users
      SET access_token = ${accessToken}, updated_at = NOW()
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.error('Failed to update user access token:', error);
    throw error;
  }
}
