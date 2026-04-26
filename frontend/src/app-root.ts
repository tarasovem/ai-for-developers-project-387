import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

import { createApiClient } from './api/client'
import { navigate, normalizeRoute } from './router'

import './pages/admin-dashboard-page'
import './pages/public-booking-page'

@customElement('app-root')
export class AppRoot extends LitElement {
  private readonly apiClient = createApiClient()

  @state()
  private route = normalizeRoute(window.location.pathname)

  private triggerPublicEvent(eventName: 'calendar:open-booking' | 'calendar:open-landing'): void {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(eventName))
    })
  }

  connectedCallback(): void {
    super.connectedCallback()
    if (
      window.location.pathname !== '/public' &&
      window.location.pathname !== '/admin'
    ) {
      navigate('/public')
    }
    window.addEventListener('popstate', this.handlePopState)
  }

  disconnectedCallback(): void {
    window.removeEventListener('popstate', this.handlePopState)
    super.disconnectedCallback()
  }

  private handlePopState = (): void => {
    this.route = normalizeRoute(window.location.pathname)
  }

  private handleRouteChange(route: '/public' | '/admin'): void {
    navigate(route)
  }

  private handlePublicNavigation(): void {
    if (this.route !== '/public') {
      this.handleRouteChange('/public')
    }
    this.triggerPublicEvent('calendar:open-booking')
  }

  private handleBrandNavigation(event: Event): void {
    event.preventDefault()
    if (this.route !== '/public') {
      this.handleRouteChange('/public')
    }
    this.triggerPublicEvent('calendar:open-landing')
  }

  render() {
    return html`
      <main class="layout">
        <header class="header">
          <a class="brand" href="/public" @click=${this.handleBrandNavigation}>
            <span class="brand-icon" aria-hidden="true"></span>
            <span class="brand-text">Calendar</span>
          </a>

          <nav class="nav">
            <button
              type="button"
              class=${this.route === '/public' ? 'nav-button active' : 'nav-button'}
              @click=${this.handlePublicNavigation}
            >
              Записаться
            </button>
            <button
              type="button"
              class=${this.route === '/admin' ? 'nav-button active' : 'nav-button'}
              @click=${() => this.handleRouteChange('/admin')}
            >
              Админка
            </button>
          </nav>
        </header>

        ${this.route === '/admin'
          ? html`<admin-dashboard-page
              .apiClient=${this.apiClient}
            ></admin-dashboard-page>`
          : html`<public-booking-page
              .apiClient=${this.apiClient}
            ></public-booking-page>`}
      </main>
    `
  }

  static styles = css`
    :host {
      color: #0f172a;
      display: block;
      font-family:
        Inter,
        system-ui,
        -apple-system,
        Segoe UI,
        sans-serif;
      min-height: 100vh;
    }

    .layout {
      box-sizing: border-box;
      margin: 0 auto;
      max-width: 1260px;
      min-height: 100vh;
      padding: 1.5rem 1.75rem 2.5rem;
    }

    .header {
      align-items: center;
      display: flex;
      flex-wrap: nowrap;
      gap: 1rem;
      justify-content: space-between;
      margin-bottom: 2.5rem;
    }

    .brand {
      align-items: center;
      color: inherit;
      display: inline-flex;
      gap: 0.55rem;
      text-decoration: none;
    }

    .brand-icon {
      background: #ff7a1a;
      border-radius: 0.35rem;
      box-shadow: inset 0 0 0 2px #fff;
      display: inline-block;
      height: 1.05rem;
      position: relative;
      width: 1.05rem;
    }

    .brand-icon::before {
      background: #fff;
      content: '';
      height: 0.14rem;
      left: 0.16rem;
      position: absolute;
      right: 0.16rem;
      top: 0.35rem;
    }

    .brand-icon::after {
      background: #fff;
      border-radius: 999px;
      content: '';
      height: 0.22rem;
      left: 0.18rem;
      position: absolute;
      top: 0.1rem;
      width: 0.22rem;
    }

    .brand-text {
      font-size: 1.52rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .nav {
      display: flex;
      gap: 0.45rem;
    }

    .nav-button {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 0.55rem;
      color: #64748b;
      cursor: pointer;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 500;
      padding: 0.4rem 0.78rem;
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        color 0.2s ease;
    }

    .nav-button:hover {
      border-color: #dbe3ef;
      color: #1e293b;
    }

    .nav-button.active {
      background: #f2f6fb;
      border-color: #dce5f2;
      color: #1f2c44;
      font-weight: 600;
    }

    @media (max-width: 820px) {
      .layout {
        padding: 1rem 1rem 1.75rem;
      }

      .header {
        margin-bottom: 1.4rem;
      }

      .brand-text {
        font-size: 1.25rem;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot
  }
}
