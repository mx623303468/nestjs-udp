import { Logger } from '@nestjs/common'
import { Server, CustomTransportStrategy } from '@nestjs/microservices'
import { createSocket, Socket, RemoteInfo } from 'dgram'
import { UdpPacket, UdpServerOptions } from '../udp.interface'
import { UdpPatternPrefix } from '../udp.constant'

/**
 * 自定义 UDP 传输策略，基于 NestJS 微服务框架
 */
export class UdpServer extends Server implements CustomTransportStrategy {
  protected logger = new Logger('UdpServer')
  private socket: Socket

  constructor(private readonly options: UdpServerOptions) {
    super()
    this.socket = createSocket(this.options.type ?? 'udp4')
  }

  /**
   * 启动 UDP 服务，并将接收到的数据路由到对应的消息处理器
   */
  public listen(callback: () => void): void {
    this.socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => this.handlePacket(msg, rinfo))

    this.socket.on('error', (err) => {
      this.logger.error('UDP socket error', err)
    })

    this.socket.once('listening', () => {
      const { address, port } = this.socket.address()
      const logMsg = `UDP server listening on ${address}:${port}`
      this.logger.debug(logMsg)
      callback()
    })

    // 绑定端口并启动服务
    this.socket.bind(this.options.port, this.options.host, () => {
      if (this.options.multicast?.enabled) {
        this.socket.addMembership(this.options.multicast.address)
        this.logger.debug(`UDP server joined multicast group ${this.options.multicast.address}`)
      } else {
        this.logger.debug(`UDP server bind port:${this.options.port}`)
      }
    })
  }

  /**
   * 关闭 UDP 服务
   */
  public close(): void {
    this.socket.close()
  }

  /**
   * 格式化数据包
   */
  protected formatPacket(packet: Buffer) {
    try {
      const decoded: UdpPacket = JSON.parse(packet.toString())
      const { pattern: rawPattern, data } = decoded
      const isObjectPattern = typeof rawPattern === 'object' && rawPattern !== null
      const pattern = isObjectPattern ? rawPattern : { cmd: rawPattern }
      const host = rawPattern.host ?? this.options.host ?? '0.0.0.0'
      const port = rawPattern.port ?? this.options.port

      const useMulticast = !!(decoded.pattern?.multicast || this.options.multicast?.enabled)

      return { pattern, data, host, port, useMulticast }
    } catch (error) {
      this.logger.error('Invalid packet format', error)
      return null
    }
  }

  protected serialize(response: any): Buffer {
    return Buffer.from(JSON.stringify({ data: response }))
  }

  /**
   * 消息处理器
   */
  private handlePacket(msg: Buffer, rinfo: RemoteInfo) {
    const packet = this.formatPacket(msg)
    if (!packet) {
      return this.sendResponse('Invalid JSON format', rinfo)
    }

    if (!packet.pattern) {
      return this.sendResponse('Missing pattern in message', rinfo)
    }

    if (!packet.pattern?.cmd.startsWith(UdpPatternPrefix)) {
      this.logger.debug(`Invalid pattern prefix. Expect prefix: "${UdpPatternPrefix}"`)
      return this.sendResponse(
        `Invalid pattern prefix. Expect prefix: "${UdpPatternPrefix}:"`,
        rinfo
      )
    }

    const handler = this.getHandlerByPattern(packet.pattern.cmd)
    if (!handler) {
      this.logger.debug(`No handler for pattern: ${packet.pattern}`, packet)
      return this.sendResponse(`No handler found for pattern: ${packet.pattern}`, rinfo)
    }

    const context = {
      rinfo,
      timestamp: Date.now(),
      rawPacket: packet
    }

    try {
      const result = handler(packet.data, context)
      this.sendResult(result, rinfo)
    } catch (error) {
      this.logger.error('Handler error', error)
      this.sendResponse(`Internal server error. ${(error as Error)?.message ?? error}`, rinfo)
    }
  }
  /**
   * 将结果转换为 Observable
   */
  private sendResult(result: any, rinfo: RemoteInfo) {
    const stream = this.transformToObservable(result)
    stream.subscribe({
      next: (res) => this.sendResponse(res, rinfo),
      error: (err) => this.logger.error('Observable error', err)
    })
  }

  /**
   * 通过 UDP 将响应数据发送回客户端
   */
  private sendResponse(response: any, rinfo: RemoteInfo): void {
    // 如果响应为空，则不需要发送回应
    if (response === null || response === undefined) {
      this.logger.debug('Response is null or undefined, not sending response')
      return
    }

    const message = this.serialize(response)
    this.socket.send(message, 0, message.length, rinfo.port, rinfo.address, (err) => {
      if (err) {
        this.logger.error('Error sending UDP response', err)
      }
    })
  }

  /**
   * 主动发送消息
   */
  public sendMessage(targetHost: string, targetPort: number, pattern: string, data: any): void {
    const message = this.serialize({ pattern, data })
    this.socket.send(message, 0, message.length, targetPort, targetHost, (err) => {
      if (err) {
        this.logger.error('Error sending UDP message', err)
      } else {
        this.logger.debug(`UDP message sent to ${targetHost}:${targetPort}`, message)
      }
    })
  }

  /**
   * 实现 Server 所需的抽象方法：on
   */
  public on<EventKey extends string = string, EventCallback extends Function = Function>(
    _pattern: EventKey,
    _callback: EventCallback
  ): any {
    throw new Error('Method on not implemented.')
  }

  /**
   * 实现 Server 所需的抽象方法：unwrap（可选实现，不使用可返回原样）
   */
  public unwrap<T = never>(): T {
    throw new Error('Method unwrap not implemented.')
  }
}
