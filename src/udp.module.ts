import { DynamicModule, Module, Provider } from "@nestjs/common";
import { UdpServerOptions } from "./udp.interface";
import { UDP_CLIENT } from "./udp.constant";
import { UdpClientProxy } from "./custom-transporters/udp.client";

@Module({})
export class UdpModule {
  static register(options: UdpServerOptions): DynamicModule {
    const udpClientProvider: Provider = {
      provide: UDP_CLIENT,
      useFactory: () => new UdpClientProxy(options),
    };

    return {
      module: UdpModule,
      providers: [udpClientProvider],
      exports: [udpClientProvider],
    };
  }
}
