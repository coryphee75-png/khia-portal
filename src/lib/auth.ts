import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';

interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  status: string;
}

// 비밀번호 검증 함수 (bcrypt 해시 비교)
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 로컬 개발 및 자체 호스팅 배포(Vercel 외 환경)에서 호스트 신뢰를 허용
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        // 필드 이름은 email 이지만 실제로는 로그인 아이디(users.email 컬럼을 그대로 재사용)입니다.
        email: { label: 'ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('아이디와 비밀번호를 입력해주세요.');
        }

        // 실제 데이터베이스에서 사용자 조회 (email 필드 = 로그인 아이디)
        const loginId = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const dbUser = await queryOne<DbUser>(
          'SELECT id, email, password_hash, name, role, status FROM users WHERE email = $1',
          [loginId]
        );

        if (!dbUser || !(await verifyPassword(password, dbUser.password_hash))) {
          throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
        }

        if (dbUser.status === 'pending') {
          throw new Error('아직 관리자 승인 대기 중인 계정입니다. 승인 후 로그인할 수 있습니다.');
        }
        if (dbUser.status === 'rejected') {
          throw new Error('가입이 거절된 계정입니다. 관리자에게 문의해주세요.');
        }

        return {
          id: String(dbUser.id),
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
        };
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
        token.id = user.id as string;
        token.role = user.role || 'parent';
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
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
    async signOut() {
      console.log(`User signed out`);
    },
  },

  debug: process.env.NODE_ENV === 'development',
});
