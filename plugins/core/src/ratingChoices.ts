/** A rating on a claim's scale, as `GET /claim-updates/rating-choices` gives it. */
export type RatingChoice = {
  slug: string
  label: string
  colour: string | null
  textColour: string | null
  retired: boolean
}

/** What the picker offers: the scale's ratings, and a retired one only if it is already chosen. */
export function ratingOptions(
  choices: readonly RatingChoice[],
  current: string | null | undefined,
): RatingChoice[] {
  return choices.filter((choice) => !choice.retired || choice.slug === current)
}
