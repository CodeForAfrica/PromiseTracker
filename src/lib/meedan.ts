const BASE_URL = 'https://check-api.checkmedia.org/api/graphql'

const createMutationQuery = () => {
  return `
    mutation createProjectMedia($input: CreateProjectMediaInput!) {
      createProjectMedia(input: $input) {
        project_media {
          id
          full_url
        }
      }
    }
  `
}

export interface FactCheck {
  title: string
  summary?: string
  url: string
  language: string
  publish_report: boolean
}

export interface CreateProjectMediaInput {
  media_type: 'Claim' | 'Link' | 'UploadedImage' | 'UploadedVideo' | 'UploadedAudio' | 'Blank'
  quote: string
  channel: { main: number }
  set_tags?: string[]
  set_status?: 'undetermined' | 'not_applicable' | 'in_progress' | 'false' | 'verified'
  set_claim_description?: string
  set_fact_check?: FactCheck
}

export interface CreateProjectMediaResponse {
  data: {
    createProjectMedia: {
      project_media: {
        id: string
        full_url: string
      }
    }
  }
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

export const postRequest = async ({
  apiKey,
  teamId,
  data,
}: {
  apiKey: string
  teamId: string
  data: CreateProjectMediaInput
}): Promise<CreateProjectMediaResponse> => {
  const query = createMutationQuery()

  const requestBody = {
    query,
    variables: {
      input: data,
    },
  }

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Check-Token': apiKey,
        'X-Check-Team': teamId,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: CreateProjectMediaResponse = await response.json()

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`)
    }

    return result
  } catch (error) {
    console.error('Error making request to CheckMedia:', error)
    throw error
  }
}

export const createFactCheckClaim = async ({
  apiKey,
  teamId,
  quote,
  tags = [],
  claimDescription,
  factCheck,
}: {
  apiKey: string
  teamId: string
  quote: string
  tags?: string[]
  claimDescription: string
  factCheck: FactCheck
}) => {
  const input: CreateProjectMediaInput = {
    media_type: 'Claim',
    quote,
    channel: { main: 1 },
    set_tags: tags,
    set_status: 'undetermined',
    set_claim_description: claimDescription,
    set_fact_check: factCheck,
  }

  return await postRequest({ apiKey, teamId, data: input })
}
