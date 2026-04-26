import { afterEach, describe, expect, it } from 'vitest'

import './app-root'

describe('app-root routing', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('рендерит публичную страницу по умолчанию', async () => {
    const element = document.createElement('app-root')
    document.body.append(element)

    await (element as unknown as { updateComplete: Promise<boolean> })
      .updateComplete
    const publicPage = element.shadowRoot?.querySelector('public-booking-page')
    expect(publicPage).not.toBeNull()
  })

  it('рендерит админскую страницу на /admin', async () => {
    window.history.pushState({}, '', '/admin')
    const element = document.createElement('app-root')
    document.body.append(element)

    await (element as unknown as { updateComplete: Promise<boolean> })
      .updateComplete
    const adminPage = element.shadowRoot?.querySelector('admin-dashboard-page')
    expect(adminPage).not.toBeNull()
  })
})
