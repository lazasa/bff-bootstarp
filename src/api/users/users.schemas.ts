import { Type, Static } from '@sinclair/typebox'

const UserStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('suspended'),
  Type.Literal('pending_verification')
])

export const UserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  status: UserStatusSchema,
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' })
})
export type User = Static<typeof UserSchema>

export const UserParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' })
})
export type UserParams = Static<typeof UserParamsSchema>

export const ListUsersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 }))
})
export type ListUsersQuery = Static<typeof ListUsersQuerySchema>

export const ListUsersResponseSchema = Type.Object({
  data: Type.Array(UserSchema),
  pagination: Type.Object({
    page: Type.Integer(),
    limit: Type.Integer(),
    hasNext: Type.Boolean(),
    hasPrev: Type.Boolean()
  })
})
export type ListUsersResponse = Static<typeof ListUsersResponseSchema>

export const CreateUserBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email' }),
    firstName: Type.Optional(Type.String()),
    lastName: Type.Optional(Type.String())
  },
  { additionalProperties: false }
)
export type CreateUserBody = Static<typeof CreateUserBodySchema>
