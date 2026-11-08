import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Pedido {
  metodo: string;
  ruta: string;
  encabezados: IncomingHttpHeaders;
  cuerpo: string;
}

export interface Respuesta {
  estado?: number;
  cuerpo?: unknown;
  /** Milisegundos que tarda en responder (para probar el tiempo máximo de 3 s). */
  esperaMs?: number;
}

/** Servicio REST simulado: guarda los pedidos y responde lo que diga `responder` (por defecto 404). */
export class ServicioSimulado {
  pedidos: Pedido[] = [];
  responder: (pedido: Pedido) => Respuesta = () => ({ estado: 404 });
  private readonly servidor: Server;

  constructor() {
    this.servidor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (parte: Buffer) => (cuerpo += parte.toString()));
      req.on('end', () => {
        const pedido = {
          metodo: req.method!,
          ruta: req.url!,
          encabezados: req.headers,
          cuerpo,
        };
        this.pedidos.push(pedido);
        const {
          estado = 200,
          cuerpo: respuesta = {},
          esperaMs = 0,
        } = this.responder(pedido);
        setTimeout(() => {
          if (res.destroyed) return;
          res.statusCode = estado;
          res.setHeader(
            'content-type',
            estado >= 400 ? 'application/problem+json' : 'application/json',
          );
          res.end(JSON.stringify(respuesta));
        }, esperaMs);
      });
    });
  }

  /** Rutas pedidas (sin método), en orden. */
  get rutas(): string[] {
    return this.pedidos.map((pedido) => pedido.ruta);
  }

  reiniciar(): void {
    this.pedidos = [];
    this.responder = () => ({ estado: 404 });
  }

  async escuchar(): Promise<string> {
    await new Promise<void>((listo) =>
      this.servidor.listen(0, '127.0.0.1', listo),
    );
    return `http://127.0.0.1:${(this.servidor.address() as AddressInfo).port}`;
  }

  cerrar(): void {
    this.servidor.closeAllConnections();
    this.servidor.close();
  }
}
