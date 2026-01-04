/**
 * Type declarations for @paypal/checkout-server-sdk
 */

declare module '@paypal/checkout-server-sdk' {
  export namespace core {
    export class Environment {
      constructor(clientId: string, clientSecret: string)
    }
    export class LiveEnvironment extends Environment {}
    export class SandboxEnvironment extends Environment {}
    export class PayPalHttpClient {
      constructor(environment: Environment)
      execute<T>(request: any): Promise<{ result: T }>
    }
  }

  export namespace orders {
    export class OrdersCreateRequest {
      prefer(value: string): void
      requestBody(body: any): void
    }
    export class OrdersCaptureRequest {
      constructor(orderId: string)
      requestBody(body: any): void
    }
  }
}

