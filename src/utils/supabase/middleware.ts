import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 期限切れの認証トークンをリフレッシュ
export async function updateSession(request: NextRequest) {
  // 初期のレスポンスを設定
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Supabaseのサーバークライアントを作成
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // クッキーを取得する関数
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        // クッキーを設定する関数
        set(name: string, value: string, options: CookieOptions) {
	        // リフレッシュした認証トークンをサーバーコンポーネントに渡す
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // リフレッシュした認証トークンをブラウザに渡す
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        // クッキーを削除する関数
        remove(name: string, options: CookieOptions) {
	        // リフレッシュした認証トークンをサーバーコンポーネントに渡す
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // リフレッシュした認証トークンをブラウザに渡す
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 現在のユーザーを取得（認証トークンをリフレッシュ）
  await supabase.auth.getUser()

  // 更新されたレスポンスを返す
  return response
}