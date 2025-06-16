import { ClientProxy, WritePacket } from '@nestjs/microservices'
import { Socket, createSocket } from 'dgram'
import { UdpPacket, UdpServerOptions } from '../udp.interface'

export class UdpClientProxy extends ClientProxy   {
  private socket: Socket

  constructor(private readonly options: UdpServerOptions) {
    super()
    this.socket = createSocket('udp4')
  }

  connect(): Promise<void> {
    return Promise.resolve()
  }

  close() {
    this.socket.close()
  }

  protected publish(packet: UdpPacket, callback: (packet: WritePacket<any>) => void): () => void {
    const { pattern, data, host, port, useMulticast } = this.formatPacket(packet)
    const address =
      useMulticast && this.options.multicast?.address ? this.options.multicast?.address : host

    const buf = Buffer.from(JSON.stringify({ pattern, data }))

    const onMessage = (msg: Buffer) => {
      const resp = JSON.parse(msg.toString())
      callback({ response: resp.data })
    }

    this.socket.send(buf, port, address, (err) => {
      if (err) {
        callback({ err })
      } else {
        this.socket.on('message', onMessage)
      }
    })

    // 返回一个取消订阅的函数
    return () => {
      this.socket.off('message', onMessage)
    }
  }

  protected dispatchEvent(packet: UdpPacket): Promise<any> {
    const { pattern, data, host, port, useMulticast } = this.formatPacket(packet)
    const address =
      useMulticast && this.options.multicast?.address ? this.options.multicast?.address : host

    return new Promise((resolve) => {
      const buf = Buffer.from(JSON.stringify({ pattern, data }))
      this.socket.send(buf, port, address, () => resolve(void 0))
    })
  }

  protected formatPacket(packet: UdpPacket): any {
    // 从 packet中获取动态目标，优先级：packet >  默认
    // {pattern: { cmd: 'udp:search', host: '127.0.0.1', port: 43210 }, data: 'hhhh'}
    // {pattern: 'udp:search', data: 'hhhh'}
    const { pattern: rawPattern, data } = packet
    const isObjectPattern = typeof rawPattern === 'object' && rawPattern !== null

    const pattern = isObjectPattern ? { cmd: rawPattern.cmd } : rawPattern
    const host = rawPattern.host ?? this.options.host
    const port = rawPattern.port ?? this.options.port

    const useMulticast = !!(packet.pattern?.multicast || this.options.multicast?.enabled)

    return { pattern, data, host, port, useMulticast }
  }

  protected serialize(packet: WritePacket<any>): any {
    return packet
  }

  protected deserialize(response: any): any {
    return response
  }

  unwrap<T>(): T {
    return undefined as T
  }
}
