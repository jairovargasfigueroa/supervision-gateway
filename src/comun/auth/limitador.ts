/**
 * Límite de peticiones por usuario en una ventana fija de un minuto (convenciones, «Seguridad»: 120 por minuto).
 * En memoria: alcanza con una sola instancia del gateway, que es como corre hoy.
 */
export class Limitador {
  private readonly ventanas = new Map<
    string,
    { inicio: number; cantidad: number }
  >();

  constructor(
    private readonly maximoPorMinuto = 120,
    private readonly ahora: () => number = Date.now,
  ) {}

  /** Cuenta una petición; devuelve los segundos que hay que esperar si se pasó del límite, o 0 si puede seguir. */
  registrar(usuarioId: string): number {
    const momento = this.ahora();
    const ventana = this.ventanas.get(usuarioId);
    if (!ventana || momento - ventana.inicio >= 60_000) {
      this.ventanas.set(usuarioId, { inicio: momento, cantidad: 1 });
      this.limpiar(momento);
      return 0;
    }
    ventana.cantidad += 1;
    if (ventana.cantidad <= this.maximoPorMinuto) return 0;
    return Math.ceil((ventana.inicio + 60_000 - momento) / 1000);
  }

  /** Quita las ventanas vencidas para que el mapa no crezca sin límite. */
  private limpiar(momento: number): void {
    if (this.ventanas.size < 1000) return;
    for (const [usuario, ventana] of this.ventanas) {
      if (momento - ventana.inicio >= 60_000) this.ventanas.delete(usuario);
    }
  }
}
