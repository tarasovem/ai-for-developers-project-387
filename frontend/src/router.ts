export type AppRoute = '/public' | '/admin'

const defaultRoute: AppRoute = '/public'

export function normalizeRoute(pathname: string): AppRoute {
  if (pathname === '/admin') {
    return '/admin'
  }

  return defaultRoute
}

export function navigate(route: AppRoute): void {
  if (window.location.pathname !== route) {
    window.history.pushState({}, '', route)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
