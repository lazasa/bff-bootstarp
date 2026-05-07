// TS types for upstream identity-service responses.
// Keep these aligned with the upstream's contract; the resource
// schemas are what the BFF advertises in OpenAPI.
export interface UpstreamUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  status: 'active' | 'suspended' | 'pending_verification'
  createdAt: string
  updatedAt: string
}

export interface UpstreamPaginatedUsers {
  data: UpstreamUser[]
  pagination: {
    page: number
    limit: number
    hasNext: boolean
    hasPrev: boolean
  }
}
