import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import { createApiClient } from '../api/client'
import type { ApiError } from '../api/errors'
import { isSlotConflict } from '../api/errors'
import type { ApiClient, EventType, Owner, Slot } from '../types/api'
import { getDefaultWindow } from '../utils/date'
import { getValidationMessage, parseBookingPayload } from '../utils/validation'

type BookingStep = 'landing' | 'event-types' | 'schedule' | 'confirm'

interface CalendarDayCell {
  dayNumber: number
  dateKey: string
  hasSlots: boolean
  isSelected: boolean
}

@customElement('public-booking-page')
export class PublicBookingPage extends LitElement {
  @property({ attribute: false })
  apiClient: ApiClient = createApiClient()

  @state()
  private owner: Owner | null = null

  @state()
  private eventTypes: EventType[] = []

  @state()
  private slots: Slot[] = []

  @state()
  private currentStep: BookingStep = 'landing'

  @state()
  private selectedEventTypeId = ''

  @state()
  private selectedDateKey = ''

  @state()
  private selectedSlotStartAt = ''

  @state()
  private guestName = ''

  @state()
  private guestEmail = ''

  @state()
  private isLoading = true

  @state()
  private isLoadingSlots = false

  @state()
  private isSubmitting = false

  @state()
  private calendarMonth = new Date().getMonth()

  @state()
  private calendarYear = new Date().getFullYear()

  @state()
  private errorMessage = ''

  @state()
  private successMessage = ''

  connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener('calendar:open-booking', this.handleOpenBookingStep)
    window.addEventListener('calendar:open-landing', this.handleOpenLandingStep)
    void this.loadInitialData()
  }

  disconnectedCallback(): void {
    window.removeEventListener('calendar:open-booking', this.handleOpenBookingStep)
    window.removeEventListener('calendar:open-landing', this.handleOpenLandingStep)
    super.disconnectedCallback()
  }

  private handleOpenBookingStep = (): void => {
    this.currentStep = 'event-types'
    this.successMessage = ''
  }

  private handleOpenLandingStep = (): void => {
    this.currentStep = 'landing'
    this.successMessage = ''
  }

  private async loadInitialData(): Promise<void> {
    this.isLoading = true
    this.errorMessage = ''

    try {
      const [owner, eventTypes] = await Promise.all([
        this.apiClient.getDefaultOwner(),
        this.apiClient.listPublicEventTypes()
      ])

      this.owner = owner
      this.eventTypes = eventTypes
      this.selectedEventTypeId = eventTypes[0]?.id ?? ''

      if (this.selectedEventTypeId) {
        await this.loadSlots(this.selectedEventTypeId)
      }
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error)
    } finally {
      this.isLoading = false
    }
  }

  private async loadSlots(eventTypeId: string): Promise<void> {
    this.errorMessage = ''
    this.isLoadingSlots = true
    const windowRange = getDefaultWindow()

    try {
      this.slots = await this.apiClient.listPublicSlots(
        eventTypeId,
        windowRange.from,
        windowRange.to
      )
      this.syncDateAndSlotSelection()
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error)
    } finally {
      this.isLoadingSlots = false
    }
  }

  private syncDateAndSlotSelection(): void {
    const dateKeys = this.getSlotDateKeys()
    if (dateKeys.length === 0) {
      this.selectedDateKey = ''
      this.selectedSlotStartAt = ''
      return
    }

    const hasSelectedDate = dateKeys.includes(this.selectedDateKey)
    const nextDateKey = hasSelectedDate ? this.selectedDateKey : dateKeys[0]
    this.selectedDateKey = nextDateKey
    this.syncCalendarToDate(nextDateKey)

    const availableSlots = this.getAvailableSlotsForDate(nextDateKey)
    if (availableSlots.length === 0) {
      this.selectedSlotStartAt = ''
      return
    }

    const selectedSlotExists = availableSlots.some(
      (slot) => slot.startAt === this.selectedSlotStartAt
    )
    if (!selectedSlotExists) {
      this.selectedSlotStartAt = availableSlots[0].startAt
    }
  }

  private handleLandingCta(): void {
    this.currentStep = 'event-types'
    this.successMessage = ''
  }

  private handleBackToEventTypes(): void {
    this.currentStep = 'event-types'
  }

  private handleBackToSchedule(): void {
    this.currentStep = 'schedule'
  }

  private handleSelectEventType(eventTypeId: string): void {
    this.selectedEventTypeId = eventTypeId
    this.selectedSlotStartAt = ''
    this.selectedDateKey = ''
    this.currentStep = 'schedule'
    this.successMessage = ''
    void this.loadSlots(eventTypeId)
  }

  private handleDateSelect(dateKey: string): void {
    this.selectedDateKey = dateKey
    this.successMessage = ''
    this.syncCalendarToDate(dateKey)

    const availableSlots = this.getAvailableSlotsForDate(dateKey)
    if (availableSlots.length === 0) {
      this.selectedSlotStartAt = ''
      return
    }

    const selectedSlotExists = availableSlots.some(
      (slot) => slot.startAt === this.selectedSlotStartAt
    )
    if (!selectedSlotExists) {
      this.selectedSlotStartAt = availableSlots[0].startAt
    }
  }

  private handleSlotSelect(slot: Slot): void {
    if (!slot.isAvailable) {
      return
    }
    this.selectedSlotStartAt = slot.startAt
    this.successMessage = ''
  }

  private handleContinueToConfirmation(): void {
    if (!this.selectedSlotStartAt) {
      return
    }
    this.currentStep = 'confirm'
  }

  private handleGuestNameInput(event: Event): void {
    const target = event.target as HTMLInputElement
    this.guestName = target.value
  }

  private handleGuestEmailInput(event: Event): void {
    const target = event.target as HTMLInputElement
    this.guestEmail = target.value
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    this.errorMessage = ''
    this.successMessage = ''
    this.isSubmitting = true

    try {
      const payload = parseBookingPayload({
        eventTypeId: this.selectedEventTypeId,
        slotStartAt: this.selectedSlotStartAt,
        guestName: this.guestName,
        guestEmail: this.guestEmail
      })
      await this.apiClient.createPublicBooking(payload)
      this.successMessage = 'Бронирование успешно создано.'
      this.guestName = ''
      this.guestEmail = ''
      this.currentStep = 'event-types'
      await this.loadSlots(this.selectedEventTypeId)
    } catch (error) {
      const apiError = this.toApiError(error)
      if (isSlotConflict(apiError)) {
        this.errorMessage =
          'Слот уже заняли. Обновили список слотов, выберите другой интервал.'
        this.currentStep = 'schedule'
        await this.loadSlots(this.selectedEventTypeId)
      } else {
        this.errorMessage = this.getErrorMessage(error)
      }
    } finally {
      this.isSubmitting = false
    }
  }

  private changeCalendarMonth(offset: number): void {
    const nextMonth = new Date(this.calendarYear, this.calendarMonth + offset, 1)
    this.calendarYear = nextMonth.getFullYear()
    this.calendarMonth = nextMonth.getMonth()
  }

  private getSelectedEventType(): EventType | null {
    const eventType =
      this.eventTypes.find((item) => item.id === this.selectedEventTypeId) ?? null
    return eventType
  }

  private getDateKey(value: string): string {
    return value.slice(0, 10)
  }

  private buildDateKey(year: number, month: number, day: number): string {
    const paddedMonth = String(month + 1).padStart(2, '0')
    const paddedDay = String(day).padStart(2, '0')
    return `${year}-${paddedMonth}-${paddedDay}`
  }

  private getSlotDateKeys(): string[] {
    const uniqueKeys = new Set<string>()
    for (const slot of this.slots) {
      uniqueKeys.add(this.getDateKey(slot.startAt))
    }
    return Array.from(uniqueKeys).sort()
  }

  private getSlotsForDate(dateKey: string): Slot[] {
    return this.slots
      .filter((slot) => this.getDateKey(slot.startAt) === dateKey)
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
  }

  private getAvailableSlotsForDate(dateKey: string): Slot[] {
    return this.getSlotsForDate(dateKey).filter((slot) => slot.isAvailable)
  }

  private hasSlotsForDate(dateKey: string): boolean {
    return this.slots.some((slot) => this.getDateKey(slot.startAt) === dateKey)
  }

  private syncCalendarToDate(dateKey: string): void {
    const date = new Date(`${dateKey}T00:00:00`)
    this.calendarYear = date.getFullYear()
    this.calendarMonth = date.getMonth()
  }

  private formatMonthLabel(): string {
    const monthLabel = new Date(this.calendarYear, this.calendarMonth, 1).toLocaleDateString(
      'ru-RU',
      {
        month: 'long',
        year: 'numeric'
      }
    )
    return monthLabel.replace(/^./, (char) => char.toUpperCase())
  }

  private formatDateLabel(dateKey: string): string {
    const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
    return label.replace(/^./, (char) => char.toUpperCase())
  }

  private formatTimeRange(slot: Slot): string {
    const startLabel = new Date(slot.startAt).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const endLabel = new Date(slot.endAt).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
    return `${startLabel} - ${endLabel}`
  }

  private getOwnerName(): string {
    if (this.owner?.displayName) {
      return this.owner.displayName
    }
    return 'Host'
  }

  private getOwnerInitials(): string {
    const words = this.getOwnerName().split(' ').filter(Boolean)
    if (words.length === 0) {
      return 'H'
    }
    const firstLetter = words[0].slice(0, 1)
    const secondLetter = words[1]?.slice(0, 1) ?? ''
    return `${firstLetter}${secondLetter}`.toUpperCase()
  }

  private buildCalendarCells(): Array<CalendarDayCell | null> {
    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1)
    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate()
    const mondayBasedDay = (firstDay.getDay() + 6) % 7
    const cells: Array<CalendarDayCell | null> = []

    for (let index = 0; index < mondayBasedDay; index += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = this.buildDateKey(this.calendarYear, this.calendarMonth, day)
      cells.push({
        dayNumber: day,
        dateKey,
        hasSlots: this.hasSlotsForDate(dateKey),
        isSelected: this.selectedDateKey === dateKey
      })
    }

    return cells
  }

  private toApiError(error: unknown): ApiError | null {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'code' in error &&
      'message' in error
    ) {
      return error as ApiError
    }

    return null
  }

  private getErrorMessage(error: unknown): string {
    const apiError = this.toApiError(error)
    if (apiError) {
      return `${apiError.message} (${apiError.code})`
    }

    return getValidationMessage(error)
  }

  private renderLanding() {
    return html`
      <section class="landing-grid">
        <article class="landing-hero">
          <span class="eyebrow">Быстрая запись на звонок</span>
          <h1>Calendar</h1>
          <p>
            Забронируйте встречу за минуту: выберите тип события и удобное время.
          </p>
          <button type="button" class="primary-button" @click=${this.handleLandingCta}>
            Записаться
          </button>
        </article>

        <article class="feature-card">
          <h2>Возможности</h2>
          <ul>
            <li>Выбор типа события и удобного времени для встречи.</li>
            <li>Быстрое бронирование с подтверждением и заметками.</li>
            <li>Управление типами встреч и просмотр записей в админке.</li>
          </ul>
        </article>
      </section>
    `
  }

  private renderWizardProgress(step: 'event-types' | 'schedule' | 'confirm') {
    return html`
      <div class="wizard-progress" aria-label="Прогресс бронирования">
        <span class=${step === 'event-types' ? 'wizard-step active' : 'wizard-step'}>
          1. Тип события
        </span>
        <span class=${step === 'schedule' ? 'wizard-step active' : 'wizard-step'}>
          2. Дата и время
        </span>
        <span class=${step === 'confirm' ? 'wizard-step active' : 'wizard-step'}>
          3. Подтверждение
        </span>
      </div>
    `
  }

  private renderEventTypes() {
    return html`
      <section class="event-types-step">
        ${this.renderWizardProgress('event-types')}
        <article class="owner-card">
          <div class="owner-avatar">${this.getOwnerInitials()}</div>
          <div class="owner-meta">
            <strong>${this.getOwnerName()}</strong>
            <span>Host</span>
          </div>
        </article>

        <h2 class="section-title">Выберите тип события</h2>
        <p class="section-subtitle">
          Нажмите на карточку, чтобы открыть календарь и выбрать удобный слот.
        </p>

        <div class="event-grid">
          ${this.eventTypes.map(
            (eventType) => html`
              <button
                type="button"
                class=${eventType.id === this.selectedEventTypeId
                  ? 'event-card active'
                  : 'event-card'}
                @click=${() => this.handleSelectEventType(eventType.id)}
              >
                <div class="event-card-head">
                  <strong>${eventType.name}</strong>
                  <span class="duration-tag">${eventType.durationMinutes} мин</span>
                </div>
                <p>${eventType.description}</p>
              </button>
            `
          )}
        </div>
      </section>
    `
  }

  private renderSchedule() {
    const selectedEventType = this.getSelectedEventType()
    const selectedDateLabel = this.selectedDateKey
      ? this.formatDateLabel(this.selectedDateKey)
      : 'Дата не выбрана'
    const daySlots = this.selectedDateKey ? this.getSlotsForDate(this.selectedDateKey) : []
    const selectedSlot = daySlots.find(
      (slot) => slot.startAt === this.selectedSlotStartAt
    )
    const selectedTimeLabel = selectedSlot
      ? this.formatTimeRange(selectedSlot)
      : 'Время не выбрано'

    return html`
      <section class="schedule-step">
        ${this.renderWizardProgress('schedule')}
        <h2 class="section-title">${selectedEventType?.name ?? 'Выберите слот'}</h2>

        <div class="schedule-grid">
          <article class="panel summary-panel">
            <div class="owner-line">
              <div class="owner-avatar">${this.getOwnerInitials()}</div>
              <div class="owner-meta">
                <strong>${this.getOwnerName()}</strong>
                <span>Host</span>
              </div>
            </div>
            <h3>${selectedEventType?.name ?? 'Тип события'}</h3>
            <p>${selectedEventType?.description ?? 'Описание пока недоступно.'}</p>
            <div class="info-box">
              <span>Выбранная дата</span>
              <strong>${selectedDateLabel}</strong>
            </div>
            <div class="info-box">
              <span>Выбранное время</span>
              <strong>${selectedTimeLabel}</strong>
            </div>
          </article>

          <article class="panel calendar-panel">
            <div class="calendar-head">
              <h3>Календарь</h3>
              <div class="calendar-nav">
                <button
                  type="button"
                  class="icon-button"
                  @click=${() => this.changeCalendarMonth(-1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  class="icon-button"
                  @click=${() => this.changeCalendarMonth(1)}
                >
                  →
                </button>
              </div>
            </div>
            <p class="calendar-month">${this.formatMonthLabel()}</p>
            <div class="calendar-weekdays">
              <span>Пн</span>
              <span>Вт</span>
              <span>Ср</span>
              <span>Чт</span>
              <span>Пт</span>
              <span>Сб</span>
              <span>Вс</span>
            </div>
            <div class="calendar-grid">
              ${this.buildCalendarCells().map((cell) => {
                if (!cell) {
                  return html`<span class="calendar-placeholder"></span>`
                }
                return html`
                  <button
                    type="button"
                    class=${cell.isSelected
                      ? 'calendar-day active'
                      : cell.hasSlots
                        ? 'calendar-day'
                        : 'calendar-day disabled'}
                    ?disabled=${!cell.hasSlots}
                    @click=${() => this.handleDateSelect(cell.dateKey)}
                  >
                    ${cell.dayNumber}
                  </button>
                `
              })}
            </div>
          </article>

          <article class="panel slots-panel">
            <h3>Статус слотов</h3>
            ${this.isLoadingSlots
              ? html`<div class="slot-state"><sl-spinner></sl-spinner></div>`
              : daySlots.length === 0
                ? html`<p class="helper">На выбранную дату слоты не найдены.</p>`
                : html`
                    <div class="slots-list">
                      ${daySlots.map(
                        (slot) => html`
                          <button
                            type="button"
                            class=${slot.startAt === this.selectedSlotStartAt
                              ? 'slot-row slot active'
                              : slot.isAvailable
                                ? 'slot-row slot'
                                : 'slot-row slot busy'}
                            ?disabled=${!slot.isAvailable}
                            @click=${() => this.handleSlotSelect(slot)}
                          >
                            <span>${this.formatTimeRange(slot)}</span>
                            <strong>${slot.isAvailable ? 'Свободно' : 'Занято'}</strong>
                          </button>
                        `
                      )}
                    </div>
                  `}

            <div class="slot-actions">
              <button type="button" class="secondary-button" @click=${this.handleBackToEventTypes}>
                Назад
              </button>
              <button
                type="button"
                class="primary-button"
                ?disabled=${!this.selectedSlotStartAt}
                @click=${this.handleContinueToConfirmation}
              >
                Продолжить
              </button>
            </div>
          </article>
        </div>
      </section>
    `
  }

  private renderConfirmation() {
    const selectedEventType = this.getSelectedEventType()
    const selectedDateLabel = this.selectedDateKey
      ? this.formatDateLabel(this.selectedDateKey)
      : 'Дата не выбрана'
    const daySlots = this.selectedDateKey ? this.getSlotsForDate(this.selectedDateKey) : []
    const selectedSlot = daySlots.find(
      (slot) => slot.startAt === this.selectedSlotStartAt
    )
    const selectedTimeLabel = selectedSlot
      ? this.formatTimeRange(selectedSlot)
      : 'Время не выбрано'

    return html`
      <section class="confirm-step">
        ${this.renderWizardProgress('confirm')}
        <h2 class="section-title">Подтверждение записи</h2>
        <p class="section-subtitle">
          Проверьте детали встречи и оставьте контактные данные.
        </p>

        <div class="confirm-grid">
          <article class="panel confirm-summary">
            <div class="owner-line">
              <div class="owner-avatar">${this.getOwnerInitials()}</div>
              <div class="owner-meta">
                <strong>${this.getOwnerName()}</strong>
                <span>Host</span>
              </div>
            </div>
            <h3>${selectedEventType?.name ?? 'Тип события'}</h3>
            <p>${selectedEventType?.description ?? 'Описание пока недоступно.'}</p>
            <div class="info-box">
              <span>Дата встречи</span>
              <strong>${selectedDateLabel}</strong>
            </div>
            <div class="info-box">
              <span>Время встречи</span>
              <strong>${selectedTimeLabel}</strong>
            </div>
          </article>

          <article class="panel confirm-form-panel">
            <h3>Контакты гостя</h3>
            <form class="booking-form" @submit=${this.handleSubmit}>
              <label class="field">
                Имя гостя
                <input
                  name="guestName"
                  type="text"
                  .value=${this.guestName}
                  @input=${this.handleGuestNameInput}
                  required
                />
              </label>
              <label class="field">
                Email гостя
                <input
                  name="guestEmail"
                  type="email"
                  .value=${this.guestEmail}
                  @input=${this.handleGuestEmailInput}
                  required
                />
              </label>
              <div class="confirm-actions">
                <button
                  type="button"
                  class="secondary-button"
                  @click=${this.handleBackToSchedule}
                >
                  Назад к слотам
                </button>
                <button
                  type="submit"
                  class="primary-button"
                  ?disabled=${this.isSubmitting || !this.selectedSlotStartAt}
                >
                  ${this.isSubmitting ? 'Создаем...' : 'Забронировать'}
                </button>
              </div>
            </form>
          </article>
        </div>
      </section>
    `
  }

  render() {
    if (this.isLoading) {
      return html`
        <section class="state-wrapper">
          <sl-spinner></sl-spinner>
          <p>Загружаем данные для бронирования...</p>
        </section>
      `
    }

    return html`
      <section class="booking-root">
        ${this.errorMessage
          ? html`<sl-alert variant="danger" open>${this.errorMessage}</sl-alert>`
          : null}
        ${this.successMessage
          ? html`<sl-alert variant="success" open>${this.successMessage}</sl-alert>`
          : null}
        ${this.currentStep === 'landing'
          ? this.renderLanding()
          : this.currentStep === 'event-types'
            ? this.renderEventTypes()
            : this.currentStep === 'schedule'
              ? this.renderSchedule()
              : this.renderConfirmation()}
      </section>
    `
  }

  static styles = css`
    .booking-root {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .landing-grid {
      align-items: start;
      display: grid;
      gap: 2rem;
      grid-template-columns: minmax(330px, 1fr) minmax(340px, 420px);
      margin-top: 2rem;
    }

    .landing-hero h1 {
      font-size: clamp(2.4rem, 5vw, 4rem);
      line-height: 1;
      margin: 0 0 0.9rem;
    }

    .landing-hero p {
      color: #53637a;
      font-size: 1.5rem;
      letter-spacing: -0.02em;
      line-height: 1.28;
      margin: 0 0 1.5rem;
      max-width: 32rem;
    }

    .eyebrow {
      background: #ecf5ff;
      border-radius: 999px;
      color: #4f6787;
      display: inline-flex;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      margin-bottom: 1rem;
      padding: 0.25rem 0.72rem;
      text-transform: uppercase;
    }

    .feature-card {
      background: rgba(255, 250, 245, 0.82);
      border: 1px solid #e6edf8;
      border-radius: 1rem;
      padding: 1.35rem 1.5rem;
    }

    .feature-card h2 {
      margin: 0 0 0.65rem;
    }

    .feature-card ul {
      color: #475569;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin: 0;
      padding-left: 1.1rem;
    }

    .event-types-step {
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid #dfe6f1;
      border-radius: 1rem;
      padding: 1.3rem;
    }

    .wizard-progress {
      align-items: center;
      display: flex;
      gap: 0.55rem;
      margin-bottom: 0.9rem;
    }

    .wizard-step {
      background: #f2f5fa;
      border: 1px solid #dce4f1;
      border-radius: 999px;
      color: #7586a0;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.22rem 0.7rem;
    }

    .wizard-step.active {
      background: #fff1e6;
      border-color: #ffc99f;
      color: #9a4f1e;
    }

    .owner-card,
    .owner-line {
      align-items: center;
      display: flex;
      gap: 0.75rem;
    }

    .owner-avatar {
      align-items: center;
      background:
        linear-gradient(180deg, #ffd6bf 48%, #119da4 48%),
        linear-gradient(180deg, #ffece2, #ffd9c5);
      border: 1px solid #e4ebf5;
      border-radius: 0.7rem;
      color: #0f172a;
      display: inline-flex;
      font-size: 0.78rem;
      font-weight: 800;
      height: 2.85rem;
      justify-content: center;
      width: 2.85rem;
    }

    .owner-meta {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .owner-meta span {
      color: #64748b;
      font-size: 0.88rem;
    }

    .section-title {
      font-size: clamp(1.65rem, 4vw, 2.75rem);
      letter-spacing: -0.02em;
      margin: 0.85rem 0 0.4rem;
    }

    .section-subtitle {
      color: #6a778d;
      margin: 0 0 1.1rem;
    }

    .event-grid {
      display: grid;
      gap: 0.9rem;
      grid-template-columns: repeat(2, minmax(260px, 1fr));
    }

    .event-card {
      background: #fff;
      border: 1px solid #e1e8f1;
      border-radius: 0.85rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      text-align: left;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }

    .event-card:hover {
      border-color: #cfdae7;
      box-shadow: 0 5px 16px rgba(15, 23, 42, 0.07);
      transform: translateY(-1px);
    }

    .event-card.active {
      border-color: #f8bb88;
      box-shadow: 0 0 0 2px rgba(248, 187, 136, 0.34);
    }

    .event-card-head {
      align-items: center;
      display: flex;
      gap: 0.5rem;
      justify-content: space-between;
    }

    .event-card-head strong {
      font-size: 1.7rem;
      letter-spacing: -0.02em;
    }

    .event-card p {
      color: #64748b;
      margin: 0;
    }

    .duration-tag {
      background: #eef3f8;
      border-radius: 999px;
      color: #7486a2;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.15rem 0.52rem;
      white-space: nowrap;
    }

    .schedule-step {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .schedule-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(220px, 280px) minmax(300px, 1fr) minmax(260px, 320px);
    }

    .panel {
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid #dce5f0;
      border-radius: 1rem;
      padding: 1rem;
    }

    .summary-panel h3 {
      font-size: 2rem;
      letter-spacing: -0.02em;
      margin: 0.85rem 0 0.55rem;
    }

    .summary-panel p {
      color: #64748b;
      margin: 0 0 0.9rem;
    }

    .info-box {
      background: #f3f7fb;
      border-radius: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      margin-bottom: 0.65rem;
      padding: 0.6rem 0.65rem;
    }

    .info-box span {
      color: #6f829d;
      font-size: 0.88rem;
    }

    .calendar-head {
      align-items: center;
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .calendar-head h3 {
      margin: 0;
    }

    .calendar-nav {
      display: flex;
      gap: 0.4rem;
    }

    .icon-button {
      align-items: center;
      background: #fff;
      border: 1px solid #dfe6f1;
      border-radius: 0.65rem;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      height: 2rem;
      justify-content: center;
      width: 2rem;
    }

    .calendar-month {
      color: #4b5d78;
      font-weight: 600;
      margin: 0 0 0.65rem;
      text-transform: capitalize;
    }

    .calendar-weekdays {
      color: #71839d;
      display: grid;
      gap: 0.35rem;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      margin-bottom: 0.35rem;
      text-align: center;
    }

    .calendar-grid {
      display: grid;
      gap: 0.35rem;
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }

    .calendar-placeholder {
      height: 2.85rem;
    }

    .calendar-day {
      align-items: center;
      background: #f6f9fc;
      border: 1px solid #dce5f0;
      border-radius: 0.62rem;
      color: #1f2b45;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-weight: 500;
      height: 2.85rem;
      justify-content: center;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }

    .calendar-day:hover {
      border-color: #bfcee0;
      transform: translateY(-1px);
    }

    .calendar-day.active {
      border-color: #0f172a;
      box-shadow: inset 0 0 0 1px #0f172a;
      font-weight: 700;
    }

    .calendar-day.disabled {
      background: #f8fafd;
      color: #b0bdd1;
      cursor: not-allowed;
    }

    .slots-panel h3 {
      margin: 0 0 0.65rem;
    }

    .slot-state {
      align-items: center;
      display: flex;
      justify-content: center;
      min-height: 6rem;
    }

    .slots-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      margin-bottom: 0.95rem;
      max-height: 23rem;
      overflow: auto;
      padding-right: 0.15rem;
    }

    .slot-row {
      align-items: center;
      background: #fff;
      border: 1px solid #e0e8f2;
      border-radius: 0.68rem;
      color: #273447;
      cursor: pointer;
      display: flex;
      font: inherit;
      justify-content: space-between;
      min-height: 2.5rem;
      padding: 0.45rem 0.65rem;
      text-align: left;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }

    .slot-row:hover {
      border-color: #c4d3e4;
      transform: translateY(-1px);
    }

    .slot-row strong {
      color: #1f2f46;
      font-size: 0.92rem;
      white-space: nowrap;
    }

    .slot-row.active {
      border-color: #ffbe8f;
      box-shadow: 0 0 0 2px rgba(255, 190, 143, 0.35);
    }

    .slot-row.busy {
      background: #f6f8fb;
      color: #8a9ab1;
      cursor: not-allowed;
    }

    .slot-row.busy strong {
      color: #7d8ba0;
    }

    .slot-actions {
      display: grid;
      gap: 0.65rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .confirm-step {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .confirm-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(260px, 340px) minmax(300px, 1fr);
    }

    .confirm-summary h3 {
      font-size: 1.65rem;
      letter-spacing: -0.02em;
      margin: 0.8rem 0 0.45rem;
    }

    .confirm-summary p {
      color: #607289;
      margin: 0 0 0.85rem;
    }

    .confirm-form-panel h3 {
      margin: 0 0 0.45rem;
    }

    .booking-form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .confirm-actions {
      display: grid;
      gap: 0.65rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field {
      display: flex;
      flex-direction: column;
      font-weight: 600;
      gap: 0.35rem;
    }

    input {
      border: 1px solid #d8e1ed;
      border-radius: 0.6rem;
      font: inherit;
      padding: 0.55rem 0.68rem;
    }

    .primary-button,
    .secondary-button {
      border-radius: 0.75rem;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      min-height: 2.7rem;
      padding: 0.5rem 0.95rem;
      transition:
        box-shadow 0.2s ease,
        transform 0.2s ease,
        background-color 0.2s ease,
        border-color 0.2s ease;
    }

    .primary-button {
      background: linear-gradient(180deg, #ff9a4a, #ff8a30);
      border: 1px solid #ff8a30;
      color: #fff;
    }

    .primary-button:hover:enabled {
      box-shadow: 0 8px 24px rgba(255, 138, 48, 0.3);
      transform: translateY(-1px);
    }

    .secondary-button {
      background: #fff;
      border: 1px solid #d6dfeb;
      color: #22334f;
    }

    .secondary-button:hover {
      border-color: #bccddd;
      transform: translateY(-1px);
    }

    .primary-button:disabled,
    .secondary-button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      transform: none;
    }

    .helper {
      color: #64748b;
      margin: 0 0 0.8rem;
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
      .schedule-grid {
        grid-template-columns: 1fr;
      }

      .confirm-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 820px) {
      .landing-grid {
        grid-template-columns: 1fr;
        margin-top: 0.6rem;
      }

      .landing-hero p {
        font-size: 1.2rem;
      }

      .event-grid {
        grid-template-columns: 1fr;
      }

      .wizard-progress {
        flex-wrap: wrap;
      }

      .confirm-actions {
        grid-template-columns: 1fr;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'public-booking-page': PublicBookingPage
  }
}
