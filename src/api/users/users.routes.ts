import { FastifyInstance } from 'fastify'
import { usersDocs } from './users.docs'
import { ListUsersQuery, CreateUserBody, UserParams } from './users.schemas'
import {
  identityServiceGet,
  identityServicePost
} from '../../services/identityService'

export const usersRoutes = async (fastify: FastifyInstance) => {
  fastify.get<{ Querystring: ListUsersQuery }>('/', {
    schema: usersDocs.listUsers,
    handler: async (request, reply) => {
      const { page, limit } = request.query
      const qs = new URLSearchParams()
      if (page !== undefined) qs.set('page', String(page))
      if (limit !== undefined) qs.set('limit', String(limit))
      const result = await identityServiceGet(
        '/v1/users/',
        request.headers.authorization,
        qs.toString() || undefined
      )
      return reply.status(200).send(result)
    }
  })

  fastify.post<{ Body: CreateUserBody }>('/', {
    schema: usersDocs.createUser,
    handler: async (request, reply) => {
      const result = await identityServicePost(
        '/v1/users/',
        request.body,
        request.headers.authorization
      )
      return reply.status(201).send(result)
    }
  })

  fastify.get<{ Params: UserParams }>('/:id', {
    schema: usersDocs.getUser,
    handler: async (request, reply) => {
      const result = await identityServiceGet(
        `/v1/users/${request.params.id}`,
        request.headers.authorization
      )
      return reply.status(200).send(result)
    }
  })
}
