import destinationContentData from './destinationContentData.json'
import { CITY_SLUGS } from './cities'

export type DestinationFaq = {
  question: string
  answer: string
}

export type DestinationContent = {
  slug: string
  seo_title: string
  seo_description: string
  h1: string
  intro: string
  seasonality: string
  faqs: DestinationFaq[]
}

const waveAContent = destinationContentData as DestinationContent[]

export const DESTINATION_CONTENT: Record<keyof typeof CITY_SLUGS, DestinationContent | undefined> =
  Object.fromEntries(
    Object.keys(CITY_SLUGS).map((slug) => [
      slug,
      waveAContent.find((content) => content.slug === slug),
    ]),
  )

