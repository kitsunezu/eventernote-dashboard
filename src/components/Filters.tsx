import type { EventCategory } from '../types/events'

interface FiltersProps {
  categories: EventCategory[]
  selectedCategoryIds: string[]
  onToggleCategory: (categoryId: string) => void
  onResetFilters: () => void
}

export function Filters({ categories, selectedCategoryIds, onToggleCategory, onResetFilters }: FiltersProps) {
  if (categories.length === 0) {
    return null
  }

  return (
    <section className="filters" aria-label="Category filters">
      <div className="filters__row">
        {categories.map((category) => {
          const isActive = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(category.id)
          return (
            <button
              key={category.id}
              className={`chip ${isActive ? 'is-active' : ''}`}
              type="button"
              onClick={() => onToggleCategory(category.id)}
            >
              <span
                aria-hidden="true"
                style={{ width: 10, height: 10, borderRadius: '999px', background: category.color }}
              />
              {category.label}
            </button>
          )
        })}
      </div>

      <div className="filters__row">
        <p className="filters__hint">Hover for a quick summary. Click any event for notes and external links.</p>
        <button className="button button--ghost" type="button" onClick={onResetFilters}>
          Reset filters
        </button>
      </div>
    </section>
  )
}