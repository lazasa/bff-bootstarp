import { commonErrorResponses } from '../../common/docs/commonResponses'
import {
  ListUsersQuerySchema,
  ListUsersResponseSchema,
  CreateUserBodySchema,
  UserSchema,
  UserParamsSchema
} from './users.schemas'

export const usersDocs = {
  listUsers: {
    summary: 'List users',
    description: 'Returns a paginated list of users (proxied from identity).',
    tags: ['Users'],
    operationId: 'listUsers',
    querystring: ListUsersQuerySchema,
    response: {
      200: ListUsersResponseSchema,
      ...commonErrorResponses
    }
  },
  createUser: {
    summary: 'Create user',
    description: 'Create a new user (proxied from identity).',
    tags: ['Users'],
    operationId: 'createUser',
    body: CreateUserBodySchema,
    response: {
      201: UserSchema,
      ...commonErrorResponses
    }
  },
  getUser: {
    summary: 'Get user',
    description: 'Returns a single user by ID (proxied from identity).',
    tags: ['Users'],
    operationId: 'getUser',
    params: UserParamsSchema,
    response: {
      200: UserSchema,
      ...commonErrorResponses
    }
  }
}
