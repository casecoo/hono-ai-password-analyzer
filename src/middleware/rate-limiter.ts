import { Context, Next } from 'hono'

const windowMs = 60 * 1000
const limit = 30


const requestCounts = new Map<string, { count: number; startTime: number }>()

export const rateLimiter = async (c: Context, next: Next) => {

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown-ip'
  const now = Date.now()

  let record = requestCounts.get(ip)

  if (!record) {
    record = { count: 1, startTime: now }
    requestCounts.set(ip, record)
  } else if (now - record.startTime > windowMs) {
    record.count = 1
    record.startTime = now
  } else {
    record.count++
  }

  if (record.count > limit) {
    return c.json({
      error: 'Too Many Requests',
      message: 'Too many requests. Please try again later.'
    }, 429)
  }

  await next()

}
