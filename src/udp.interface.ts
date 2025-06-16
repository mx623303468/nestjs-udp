import { ReadPacket } from "@nestjs/microservices";
import { RemoteInfo, SocketType } from "dgram";

/**
 * UDP 上下文
 */
export interface UdpContext {
  rinfo: RemoteInfo;
  timestamp: number;
  rawPacket: {
    pattern: string | { cmd: string; port?: number; host?: string };
    data: any;
  };
}

/**
 * UDP 服务选项
 */
export interface UdpServerOptions {
  /** 使用的 Socket 类型，默认为 'udp4' */
  type?: SocketType;
  /** 绑定端口 */
  port: number;
  /** 绑定地址，默认为 '0.0.0.0' */
  host?: string;
  multicast?: {
    enabled: boolean;
    address: string; // 如：'230.185.192.108'
  };
}

/**
 * UDP 客户端数据包
 */
export type UdpPacket = ReadPacket<any> & UdpServerOptions;

export interface EncryptedPacket {
  /**
   * 加密时生成的随机 IV（Initialization Vector），用于 AES-GCM
   * 通常是 12 字节（96 位），用 Base64 编码
   */
  iv: string;

  /**
   * 加密后的密文，使用 AES-256-GCM 加密后的结果
   * 使用 Base64 编码以便传输
   */
  ciphertext: string;

  /**
   * GCM 模式下生成的认证标签（Authentication Tag）
   * 用于校验密文未被篡改，也用 Base64 编码
   */
  authTag: string;

  /**
   * 签名字符串，使用 HMAC-SHA256 生成的签名
   * 签名内容为：iv + ciphertext + authTag
   * 签名密钥为服务端和客户端共享的 HMAC 密钥
   */
  signature: string;
}
