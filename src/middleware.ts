import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) {
      user = data.user
    } else if (error.status === 400 && error.code === 'refresh_token_not_found') {
      // Stale session — clear all Supabase auth cookies and redirect to login
      const clearResponse = NextResponse.redirect(new URL('/login', request.url))
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-')) {
          clearResponse.cookies.delete(name)
        }
      })
      return clearResponse
    }
  } catch {
    // Network or unexpected error — fail open, let the page handle it
  }

  const pathname = request.nextUrl.pathname
  const protectedRoutes = ['/dashboard', '/scan', '/account']
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r))

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users from landing page to dashboard
  if (pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
