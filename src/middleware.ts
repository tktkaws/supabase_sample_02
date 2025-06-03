import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
	// 期限切れの認証トークンをリフレッシュ
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 以下3つのパスを除くすべてのリクエストでミドルウェアを適用する。
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * 適宜変更してもOK
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}