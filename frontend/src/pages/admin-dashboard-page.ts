import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { createApiClient } from '../api/client'
import type { ApiClient, Booking, EventType, Owner } from '../types/api'
import { formatDateTime, toUtcFromLocalInput } from '../utils/date'
import {
  getValidationMessage,
  parseEventTypePayload
} from '../utils/validation'

@customElement('admin-dashboard-page')
export class AdminDashboardPage extends LitElement {
  @property({ attribute: false })
  apiClient: ApiClient = createApiClient()

  @state()
  private owner: Owner | null = null

  @state()
  private eventTypes: EventType[] = []

  @state()
  private bookings: Booking[] = []

  @state()
  private isLoading = true

  @state()
  private isSubmitting = false

  @state()
  private errorMessage = ''

  @state()
  private successMessage = ''

  @state()
  private fromFilter = ''

  @state()
  private toFilter = ''

  @state()
  private createForm = {
    id: '',
    name: '',
    description: '',
    durationMinutes: '30'
  }

  connectedCallback(): void {
    super.connectedCallback()
    void this.loadDashboard()
  }

  private async loadDashboard(): Promise<void> {
    this.isLoading = true
    this.errorMessage = ''

    try {
      const [owner, eventTypes, bookings] = await Promise.all([
        this.apiClient.getDefaultOwner(),
        this.apiClient.listAdminEventTypes(),
        this.apiClient.listUpcomingBookings()
      ])

      this.owner = owner
      this.eventTypes = eventTypes
      this.bookings = bookings
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error)
    } finally {
      this.isLoading = false
    }
  }

  private handleCreateFormInput(event: Event): void {
    const target = event.target as HTMLInputElement
    this.createForm = {
      ...this.createForm,
      [target.name]: target.value
    }
  }

  private handleFilterInput(event: Event): void {
    const target = event.target as HTMLInputElement
    if (target.name === 'fromFilter') {
      this.fromFilter = target.value
      return
    }

    this.toFilter = target.value
  }

  private async handleCreateEventType(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    this.errorMessage = ''
    this.successMessage = ''
    this.isSubmitting = true

    try {
      const payload = parseEventTypePayload(this.createForm)
      const eventType = await this.apiClient.createAdminEventType(payload)
      this.eventTypes = [...this.eventTypes, eventType]
      this.createForm = {
        id: '',
        name: '',
        description: '',
        durationMinutes: '30'
      }
      this.successMessage = `Тип события ${eventType.name} создан.`
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error)
    } finally {
      this.isSubmitting = false
    }
  }

  private async handleLoadFilteredBookings(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    await this.loadFilteredBookings()
  }

  private async loadFilteredBookings(): Promise<void> {
    this.errorMessage = ''

    const from = this.fromFilter
      ? toUtcFromLocalInput(this.fromFilter)
      : undefined
    const to = this.toFilter ? toUtcFromLocalInput(this.toFilter) : undefined

    try {
      this.bookings = await this.apiClient.listUpcomingBookings(from, to)
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error)
    }
  }

  private toLocalInputValue(value: Date): string {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  private async handleApplyQuickRange(days: number): Promise<void> {
    const from = new Date()
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
    this.fromFilter = this.toLocalInputValue(from)
    this.toFilter = this.toLocalInputValue(to)
    await this.loadFilteredBookings()
  }

  private async handleResetFilters(): Promise<void> {
    this.fromFilter = ''
    this.toFilter = ''
    this.errorMessage = ''
    try {
      this.bookings = await this.apiClient.listUpcomingBookings()
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error)
    }
  }

  private getEventTypeName(eventTypeId: string): string {
    const match = this.eventTypes.find((eventType) => eventType.id === eventTypeId)
    return match?.name ?? eventTypeId
  }

  private formatStatus(status: Booking['status']): string {
    return status === 'confirmed' ? 'Подтверждено' : 'Отменено'
  }

  private getErrorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      'code' in error
    ) {
      const apiError = error as { message: string; code: string }
      return `${apiError.message} (${apiError.code})`
    }

    return getValidationMessage(error)
  }

  render() {
    if (this.isLoading) {
      return html`
        <section class="state-wrapper">
          <sl-spinner></sl-spinner>
          <p>Загружаем административные данные...</p>
        </section>
      `
    }

    const ownerName = this.owner?.displayName ?? 'Неизвестный владелец'
    const isFiltered = Boolean(this.fromFilter || this.toFilter)

    return html`
      <section class="dashboard">
        ${this.errorMessage
          ? html`<sl-alert variant="danger" open
              >${this.errorMessage}</sl-alert
            >`
          : null}
        ${this.successMessage
          ? html`<sl-alert variant="success" open
              >${this.successMessage}</sl-alert
            >`
          : null}

        <section class="panel hero-panel">
          <div>
            <span class="eyebrow">Панель управления</span>
            <h2>Админка Calendar</h2>
            <p>
              Управляйте типами событий и контролируйте бронирования без лишних
              шагов.
            </p>
          </div>
          <button
            type="button"
            class="secondary-button"
            @click=${() => void this.loadDashboard()}
          >
            Обновить данные
          </button>
        </section>

        <section class="panel bookings-panel">
          <div class="panel-head">
            <h3>Предстоящие бронирования</h3>
            <span class="count-badge">${this.bookings.length}</span>
          </div>
          <p class="helper">
            Начните работу с просмотра ближайших встреч, затем переходите к
            управлению типами событий.
          </p>
          <form class="booking-filters" @submit=${this.handleLoadFilteredBookings}>
            <div class="filter-main">
              <label class="field filter-field">
                От
                <input
                  name="fromFilter"
                  type="datetime-local"
                  .value=${this.fromFilter}
                  @input=${this.handleFilterInput}
                />
              </label>
              <label class="field filter-field">
                До
                <input
                  name="toFilter"
                  type="datetime-local"
                  .value=${this.toFilter}
                  @input=${this.handleFilterInput}
                />
              </label>
              <button type="submit" class="secondary-button filter-apply-button">
                Применить
              </button>
            </div>

            <div class="filter-presets">
              <span class="preset-label">Быстрые периоды:</span>
              <div class="preset-actions">
                <button
                  type="button"
                  class="ghost-button"
                  @click=${() => void this.handleApplyQuickRange(1)}
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  class="ghost-button"
                  @click=${() => void this.handleApplyQuickRange(7)}
                >
                  7 дней
                </button>
                <button
                  type="button"
                  class="ghost-button"
                  @click=${() => void this.handleResetFilters()}
                >
                  Сбросить
                </button>
              </div>
            </div>
          </form>

          ${this.bookings.length === 0
            ? html`
                <div class="empty-state">
                  <strong>Бронирования не найдены</strong>
                  <p>Измените период фильтра или дождитесь новых записей.</p>
                </div>
              `
            : html`
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Слот</th>
                        <th>Тип события</th>
                        <th>Гость</th>
                        <th>Email</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.bookings.map(
                        (booking) => html`
                          <tr>
                            <td>${formatDateTime(booking.slotStartAt)}</td>
                            <td>${this.getEventTypeName(booking.eventTypeId)}</td>
                            <td>${booking.guestName}</td>
                            <td>${booking.guestEmail}</td>
                            <td>
                              <span
                                class=${booking.status === 'confirmed'
                                  ? 'status-badge status-confirmed'
                                  : 'status-badge status-cancelled'}
                              >
                                ${this.formatStatus(booking.status)}
                              </span>
                            </td>
                          </tr>
                        `
                      )}
                    </tbody>
                  </table>
                </div>
              `}
        </section>

        <section class="stats-grid">
          <article class="panel stat-card">
            <span class="stat-label">Владелец</span>
            <strong>${ownerName}</strong>
            <small>${this.owner?.timezone ?? 'Timezone не задан'}</small>
          </article>
          <article class="panel stat-card">
            <span class="stat-label">Типы событий</span>
            <strong>${this.eventTypes.length}</strong>
            <small>Доступно для публичной записи</small>
          </article>
          <article class="panel stat-card">
            <span class="stat-label">Бронирования</span>
            <strong>${this.bookings.length}</strong>
            <small>
              ${isFiltered ? 'Только по выбранному фильтру' : 'Все предстоящие'}
            </small>
          </article>
        </section>

        <section class="panel owner-panel">
          <div class="panel-head">
            <h3>Профиль владельца</h3>
            ${this.owner
              ? this.owner.isDefaultProfile
                ? html`<span class="pill">Профиль по умолчанию</span>`
                : html`<span class="pill muted">Дополнительный профиль</span>`
              : html`<span class="pill muted">Профиль недоступен</span>`}
          </div>
          ${this.owner
            ? html`
                <dl class="owner-grid">
                  <div>
                    <dt>ID</dt>
                    <dd>${this.owner.id}</dd>
                  </div>
                  <div>
                    <dt>Имя</dt>
                    <dd>${this.owner.displayName}</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd>${this.owner.timezone}</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>${this.owner.isDefaultProfile ? 'Основной' : 'Обычный'}</dd>
                  </div>
                </dl>
              `
            : html`<p class="helper">Данные владельца недоступны.</p>`}
        </section>

        <section class="admin-grid">
          <article class="panel events-panel">
            <div class="panel-head">
              <h3>Типы событий</h3>
              <span class="count-badge">${this.eventTypes.length}</span>
            </div>
            <p class="helper">
              Кликните на карточку в публичной части, чтобы проверить отображение
              нового типа.
            </p>
            <ul class="event-list">
              ${this.eventTypes.map(
                (eventType) => html`
                  <li class="event-item">
                    <div class="event-item-head">
                      <strong>${eventType.name}</strong>
                      <span class="duration-pill">${eventType.durationMinutes} мин</span>
                    </div>
                    <p>${eventType.description}</p>
                    <code>${eventType.id}</code>
                  </li>
                `
              )}
            </ul>
          </article>

          <article class="panel create-panel">
            <h3>Создать новый тип</h3>
            <p class="helper">
              Заполните базовые поля. Новый тип сразу появится в публичном
              интерфейсе.
            </p>
            <form class="form-grid" @submit=${this.handleCreateEventType}>
              <label class="field">
                ID
                <input
                  name="id"
                  type="text"
                  .value=${this.createForm.id}
                  @input=${this.handleCreateFormInput}
                  required
                />
              </label>
              <label class="field">
                Название
                <input
                  name="name"
                  type="text"
                  .value=${this.createForm.name}
                  @input=${this.handleCreateFormInput}
                  required
                />
              </label>
              <label class="field">
                Описание
                <input
                  name="description"
                  type="text"
                  .value=${this.createForm.description}
                  @input=${this.handleCreateFormInput}
                  required
                />
              </label>
              <label class="field">
                Длительность (минуты)
                <input
                  name="durationMinutes"
                  type="number"
                  min="5"
                  .value=${this.createForm.durationMinutes}
                  @input=${this.handleCreateFormInput}
                  required
                />
              </label>
              <button
                type="submit"
                class="primary-button"
                ?disabled=${this.isSubmitting}
              >
                ${this.isSubmitting ? 'Сохраняем...' : 'Создать тип события'}
              </button>
            </form>
          </article>
        </section>

      </section>
    `
  }

  static styles = css`
    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .panel {
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid #dce5f0;
      border-radius: 1rem;
      padding: 1rem;
    }

    .hero-panel {
      align-items: start;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
    }

    .hero-panel h2 {
      font-size: clamp(1.8rem, 3.5vw, 2.4rem);
      letter-spacing: -0.02em;
      margin: 0.25rem 0 0.35rem;
    }

    .hero-panel p {
      color: #607289;
      margin: 0;
      max-width: 42rem;
    }

    .eyebrow {
      background: #eff5ff;
      border-radius: 999px;
      color: #5c6f8d;
      display: inline-flex;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 0.2rem 0.65rem;
      text-transform: uppercase;
    }

    .stats-grid {
      display: grid;
      gap: 0.85rem;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat-label {
      color: #71839d;
      font-size: 0.84rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .stat-card strong {
      font-size: 1.5rem;
      letter-spacing: -0.02em;
    }

    .stat-card small {
      color: #677991;
    }

    .owner-panel {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .panel-head {
      align-items: center;
      display: flex;
      gap: 0.6rem;
      justify-content: space-between;
    }

    .panel-head h3 {
      margin: 0;
    }

    .pill {
      background: #eaf8ee;
      border: 1px solid #c9ebd4;
      border-radius: 999px;
      color: #236447;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      white-space: nowrap;
    }

    .pill.muted {
      background: #f3f6fa;
      border-color: #dce3ef;
      color: #65778f;
    }

    .owner-grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 0;
    }

    .owner-grid div {
      background: #f5f8fc;
      border-radius: 0.7rem;
      padding: 0.6rem 0.7rem;
    }

    .owner-grid dt {
      color: #71839d;
      font-size: 0.82rem;
      font-weight: 600;
      margin: 0 0 0.2rem;
    }

    .owner-grid dd {
      font-weight: 600;
      margin: 0;
    }

    .admin-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    }

    .events-panel,
    .create-panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .event-list {
      display: grid;
      gap: 0.7rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .event-item {
      background: #fff;
      border: 1px solid #e1e8f2;
      border-radius: 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.75rem;
    }

    .event-item-head {
      align-items: center;
      display: flex;
      gap: 0.45rem;
      justify-content: space-between;
    }

    .event-item p {
      color: #62758e;
      margin: 0;
    }

    .event-item code {
      color: #4a5f7b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.8rem;
    }

    .duration-pill {
      background: #eef3f8;
      border-radius: 999px;
      color: #7486a2;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.14rem 0.5rem;
      white-space: nowrap;
    }

    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-weight: 600;
    }

    input {
      border: 1px solid #d8e1ed;
      border-radius: 0.6rem;
      font: inherit;
      padding: 0.52rem 0.66rem;
    }

    .bookings-panel {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .count-badge {
      background: #f2f6fb;
      border: 1px solid #dce4ef;
      border-radius: 999px;
      color: #4f647f;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.18rem 0.54rem;
    }

    .booking-filters {
      background: #f7f9fc;
      border: 1px solid #dce4ef;
      border-radius: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.75rem;
    }

    .filter-main {
      align-items: end;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    }

    .filter-field {
      min-width: 0;
    }

    .filter-apply-button {
      white-space: nowrap;
    }

    .filter-presets {
      align-items: center;
      background: #fff;
      border: 1px dashed #dce4ef;
      border-radius: 0.75rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      justify-content: space-between;
      padding: 0.55rem 0.6rem;
    }

    .preset-label {
      color: #6b7d96;
      font-size: 0.84rem;
      font-weight: 600;
    }

    .preset-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .table-wrap {
      overflow: auto;
    }

    table {
      border-collapse: collapse;
      min-width: 720px;
      width: 100%;
    }

    th,
    td {
      border-bottom: 1px solid #dbe4ef;
      padding: 0.55rem 0.35rem;
      text-align: left;
      vertical-align: top;
    }

    th {
      color: #677991;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .status-badge {
      border-radius: 999px;
      display: inline-flex;
      font-size: 0.76rem;
      font-weight: 700;
      padding: 0.17rem 0.52rem;
      white-space: nowrap;
    }

    .status-confirmed {
      background: #eaf8ee;
      border: 1px solid #c9ebd4;
      color: #246748;
    }

    .status-cancelled {
      background: #f4f6fa;
      border: 1px solid #dde3ed;
      color: #5e6f87;
    }

    .empty-state {
      background: #f7f9fc;
      border: 1px dashed #d9e3ef;
      border-radius: 0.8rem;
      color: #607289;
      padding: 0.85rem;
    }

    .empty-state strong {
      color: #1f2f46;
      display: block;
      margin-bottom: 0.2rem;
    }

    .empty-state p {
      margin: 0;
    }

    .helper {
      color: #62758e;
      margin: 0;
    }

    .primary-button,
    .secondary-button,
    .ghost-button {
      border-radius: 0.7rem;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      min-height: 2.6rem;
      padding: 0.45rem 0.85rem;
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }

    .primary-button {
      background: linear-gradient(180deg, #ff9a4a, #ff8a30);
      border: 1px solid #ff8a30;
      color: #fff;
    }

    .secondary-button {
      background: #fff;
      border: 1px solid #d6dfeb;
      color: #21324f;
    }

    .ghost-button {
      background: #f7f9fc;
      border: 1px solid #dbe4ef;
      color: #4d627e;
    }

    .primary-button:hover:enabled,
    .secondary-button:hover:enabled,
    .ghost-button:hover:enabled {
      transform: translateY(-1px);
    }

    .primary-button:hover:enabled {
      box-shadow: 0 8px 22px rgba(255, 138, 48, 0.3);
    }

    .primary-button:disabled,
    .secondary-button:disabled,
    .ghost-button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      transform: none;
    }

    .state-wrapper {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      justify-content: center;
      min-height: 220px;
    }

    @media (max-width: 1120px) {
      .stats-grid,
      .owner-grid,
      .admin-grid {
        grid-template-columns: 1fr;
      }

      .filter-main {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .filter-apply-button {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 760px) {
      .filter-main {
        grid-template-columns: 1fr;
      }

      .filter-presets {
        align-items: start;
        flex-direction: column;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-dashboard-page': AdminDashboardPage
  }
}
