import { applyDecorators } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { UdpPatternPrefix } from './udp.constant'

type PrefixPattern<Prefix extends string> = `${Prefix}${string}`

function createUdpPattern<Prefix extends string>(
  prefix: Prefix
): (pattern: PrefixPattern<Prefix>) => MethodDecorator {
  return (pattern: PrefixPattern<Prefix>): MethodDecorator => {
    if (!pattern.startsWith(UdpPatternPrefix)) {
      throw new Error(
        `@${prefix.toUpperCase()}Pattern: pattern "${pattern}" 必须以 "${prefix}" 开头`
      )
    }

    return applyDecorators(MessagePattern(pattern, { transport: 'UDP' }))
  }
}


export const UdpPattern = createUdpPattern(UdpPatternPrefix)
