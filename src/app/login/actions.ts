'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/utils/supabase/server'

/**
 * ログイン
 *
 * ログインが成功した場合はトップページへリダイレクトする。
 * ログインに失敗した場合はエラーページへリダイレクトする。
 *
 * @param formData - フォームから受け取ったデータ
 * @returns void
 */
export async function login(formData: FormData) {
	// ✅Supabaseクライアント
  const supabase = createClient()

	// フォームからデータ取得
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

	// ✅ログイン
  const { error } = await supabase.auth.signInWithPassword(data)

	// ログインエラーの場合
  if (error) {
    redirect('/error')    // 「/error」はまだ作っていない。後で作る。
  }

	// トップページのlayoutを再検証
  revalidatePath('/', 'layout')
  // トップページへリダイレクト
  redirect('/')
}

/**
 * サインアップ
 *
 * サインアップが成功した場合はトップページへリダイレクトする。
 * サインアップに失敗した場合はエラーページへリダイレクトする。
 *
 * @param formData - フォームから受け取ったデータ
 * @returns void
 */
export async function signup(formData: FormData) {
	// ✅Supabaseクライアント
  const supabase = createClient()

	// フォームからデータ取得
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

	// ✅サインアップ
  const { error } = await supabase.auth.signUp(data)

	// サインアップエラーの場合
  if (error) {
    redirect('/error')    // 「/error」はまだ作っていない。後で作る。
  }

	// トップページのlayoutを再検証
  revalidatePath('/', 'layout')
  // トップページへリダイレクト
  redirect('/')
}