import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { queryOne } from './db';
import { User } from '@/types';

// 비밀번호 검증 함수 (실제 구현에서는 bcrypt 사용)
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // TODO: bcrypt을 사용하여 실제 구현
  return password === hashedPassword;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('이메일과 비밀번호를 입력해주세요.');
        }

        // TODO: 실제 데이터베이스에서 사용자 조회
        // const user = await queryOne<any>(
        //   'SELECT * FROM users WHERE email = $1',
        //   [credentials.email]
        // );
        
        // if (!user || !(await verifyPassword(credentials.password, user.password))) {
        //   throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        // }

        // 임시 사용자 (개발용)
        if (credentials.email === 'parent@example.com' && credentials.password === 'password') {
          return {
            id: '1',
            email: credentials.email,
            name: '김학부모',
            role: 'parent',
          };
        }

        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      },
    }),
  ],
  
  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'parent';
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // 로그인 후 대시보드로 리다이렉트
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
    updateAge: 24 * 60 * 60, // 1일
  },

  events: {
    async signIn({ user }) {
      console.log(`User ${user.email} signed in`);
    },
    async signOut({ token }) {
      console.log(`User signed out`);
    },
  },

  debug: process.env.NODE_ENV === 'development',
});
