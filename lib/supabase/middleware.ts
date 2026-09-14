import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

/**
 * Refreshes the Supabase auth session on every request and enforces:
 *  - redirect-if-unauthenticated for the backoffice route group,
 *  - the Staff route guard (FR-037, widened by Constitution v1.5.0): a `staff`
 *    session may only reach `/visitors`, `/incidencias`, or `/packages`.
 * This runs in middleware (not the layout) because only middleware sees the
 * request pathname before the response is produced.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute = pathname === '/login';

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && !isPublicRoute) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isStaffOnly =
      (roles?.some((r) => r.role === 'staff') ?? false) &&
      !(roles?.some((r) => r.role === 'building_admin' || r.role === 'app_admin') ?? false);

    if (
      isStaffOnly &&
      !pathname.startsWith('/visitors') &&
      !pathname.startsWith('/incidencias') &&
      !pathname.startsWith('/packages') &&
      !pathname.startsWith('/maintenance') &&
      !pathname.startsWith('/emergency') &&
      !pathname.startsWith('/broadcast') &&
      // 016-panel-dashboard-overview (T019, US4): the Panel dashboard is not
      // itself a new module grant -- app/(backoffice)/panel/page.tsx only
      // ever surfaces data from the modules Staff already has above.
      !pathname.startsWith('/panel')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/visitors';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
