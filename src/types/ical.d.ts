declare module 'ical.js' {
  namespace ICAL {
    function parse(input: string): unknown

    class Duration {}

    class Time {
      isDate: boolean
      clone(): Time
      addDuration(duration: Duration): void
      subtractDate(other: Time): Duration
      toJSDate(): Date
      toString(): string
    }

    class Component {
      constructor(data: unknown)
      getAllSubcomponents(name: string): Component[]
      getFirstPropertyValue(name: string): unknown
    }

    class Event {
      constructor(component: Component)
      uid?: string
      summary?: string
      description?: string
      location?: string
      organizer?: unknown
      startDate: Time
      endDate: Time
      duration?: Duration
      isRecurring(): boolean
    }

    interface RecurExpansionOptions {
      component: Component
      dtstart: Time
    }

    class RecurExpansion {
      constructor(options: RecurExpansionOptions)
      complete: boolean
      next(): Time | null
    }
  }

  export default ICAL
}
